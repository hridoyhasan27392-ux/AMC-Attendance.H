/* AMC Economics Attendance */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const config = window.AMC_FIREBASE_CONFIG || {};

  let auth = null;
  let db = null;
  let currentUser = null;
  let profile = null;
  let active = "dashboard";
  let profileCheckId = 0;

  const configured = Boolean(
    config.apiKey &&
    config.projectId &&
    config.appId &&
    !String(config.apiKey).startsWith("PASTE_") &&
    !String(config.projectId).startsWith("PASTE_") &&
    !String(config.appId).startsWith("PASTE_")
  );

  const tabs = {
    admin: [
      ["dashboard", "ড্যাশবোর্ড"],
      ["students", "শিক্ষার্থী"],
      ["teachers", "শিক্ষক ও ব্যবহারকারী"],
      ["courses", "কোর্স"],
      ["sessions", "সেশন"],
      ["attendance", "হাজিরা"],
      ["notices", "নোটিশ"],
      ["marks", "নম্বর"],
      ["reports", "রিপোর্ট"],
      ["backup", "ব্যাকআপ"]
    ],
    teacher: [
      ["dashboard", "ড্যাশবোর্ড"],
      ["students", "শিক্ষার্থী তালিকা"],
      ["attendance", "হাজিরা নেওয়া"],
      ["notices", "নোটিশ"],
      ["marks", "নম্বর"],
      ["reports", "রিপোর্ট"]
    ],
    student: [
      ["dashboard", "ড্যাশবোর্ড"],
      ["myattendance", "আমার হাজিরা"],
      ["notices", "নোটিশ"],
      ["mymarks", "আমার নম্বর"]
    ]
  };

  const esc = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));

  const today = () => {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  };

  function message(text, error = false) {
    const el = $("loginMsg");
    if (!el) return;
    el.textContent = text;
    el.style.color = error ? "#dc2626" : "#15803d";
  }

  function showNotice(text) {
    const el = $("setupNotice");
    if (!el) return;
    el.textContent = text;
    el.classList.remove("hidden");
  }

  function showError(error) {
    console.error(error);
    alert(error?.message || String(error));
  }

  function roleBn(role) {
    return ({
      admin: "অ্যাডমিন",
      teacher: "শিক্ষক",
      student: "শিক্ষার্থী"
    })[role] || role;
  }

  function initializeFirebase() {
    if (!configured) {
      showNotice("config.js ফাইলে Firebase সেটআপ পরীক্ষা করুন।");
      return;
    }

    if (typeof firebase === "undefined") {
      showNotice("Firebase SDK লোড হয়নি। ইন্টারনেট পরীক্ষা করুন।");
      return;
    }

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }

      auth = firebase.auth();
      db = firebase.firestore();

      auth.onAuthStateChanged(loadProfile);
    } catch (error) {
      console.error(error);
      showNotice("Firebase শুরু করা যায়নি: " + error.message);
    }
  }

  if ($("themeBtn")) {
    $("themeBtn").onclick = () => {
      document.body.classList.toggle("dark");
      localStorage.setItem(
        "amc-theme",
        document.body.classList.contains("dark") ? "dark" : "light"
      );
    };
  }

  if (localStorage.getItem("amc-theme") === "dark") {
    document.body.classList.add("dark");
  }

  $("loginForm").onsubmit = async event => {
    event.preventDefault();

    if (!auth) {
      message("Firebase সংযোগ প্রস্তুত নয়।", true);
      return;
    }

    message("লগইন হচ্ছে…");

    try {
      await auth.signInWithEmailAndPassword(
        $("email").value.trim(),
        $("password").value
      );
    } catch (error) {
      console.error(error);
      message("লগইন হয়নি: " + error.message, true);
    }
  };

  $("logoutBtn").onclick = async () => {
    try {
      if (auth) await auth.signOut();
    } catch (error) {
      showError(error);
    }
  };

  async function loadProfile(user) {
    const checkId = ++profileCheckId;
    currentUser = user;
    profile = null;

    if (!user) {
      $("app").classList.add("hidden");
      $("loginCard").classList.remove("hidden");
      return;
    }

    $("app").classList.add("hidden");
    $("loginCard").classList.remove("hidden");
    message("প্রোফাইল পরীক্ষা হচ্ছে…");

    try {
      console.log("Project ID:", config.projectId);
      console.log("Logged-in UID:", user.uid);

      const ref = db.collection("profiles").doc(user.uid);
      console.log("Profile path:", ref.path);

      const snap = await ref.get({ source: "server" });

      if (checkId !== profileCheckId) return;

      if (!snap.exists) {
        message(
          "প্রোফাইল পাওয়া যায়নি। Project: " +
          config.projectId +
          " | UID: " + user.uid +
          " | Path: " + ref.path,
          true
        );
        return;
      }

      const data = snap.data();
      const role = String(data.role || "").trim().toLowerCase();

      if (!["admin", "teacher", "student"].includes(role)) {
        message("প্রোফাইল আছে, কিন্তু role সঠিক নয়: " + role, true);
        return;
      }

      profile = { ...data, role };

      $("loginCard").classList.add("hidden");
      $("app").classList.remove("hidden");

      $("welcomeTitle").textContent =
        (profile.name || user.email) + " — " + roleBn(role);
      $("userLine").textContent =
        user.email + " · " + roleBn(role);

      active = "dashboard";
      buildNav();
      await render();

    } catch (error) {
      if (checkId !== profileCheckId) return;
      console.error("Profile error:", error);

      message(
        "Profile Error: " +
        (error.code || "unknown") + " — " + error.message,
        true
      );
    }
       }function buildNav() {
    const nav = $("menu");
    if (!nav || !profile) return;

    nav.innerHTML = "";

    (tabs[profile.role] || []).forEach(([id, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.className = id === active ? "active" : "";

      button.onclick = async () => {
        active = id;
        buildNav();
        await render();
      };

      nav.appendChild(button);
    });
  }

  async function readCollection(name) {
    const snap = await db.collection(name).get();
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  async function getData() {
    const names = [
      "students",
      "profiles",
      "courses",
      "sessions",
      "attendance",
      "notices",
      "marks"
    ];

    const result = {};

    for (const name of names) {
      try {
        result[name] = await readCollection(name);
      } catch (error) {
        console.warn("Could not load " + name, error);
        result[name] = [];
      }
    }

    return result;
  }

  function table(headers, rows) {
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows.map(row =>
                    `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join("")}</tr>`
                  ).join("")
                : `<tr><td colspan="${headers.length}">কোনো তথ্য পাওয়া যায়নি</td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;
  }

  function field(label, name, type = "text", required = true) {
    return `
      <label class="field">
        <span>${esc(label)}</span>
        <input
          name="${esc(name)}"
          type="${esc(type)}"
          ${required ? "required" : ""}
        >
      </label>
    `;
  }

  function selectField(label, name, options) {
    return `
      <label class="field">
        <span>${esc(label)}</span>
        <select name="${esc(name)}" required>
          <option value="">নির্বাচন করুন</option>
          ${options.map(option =>
            `<option value="${esc(option.value)}">${esc(option.label)}</option>`
          ).join("")}
        </select>
      </label>
    `;
  }

  function formCard(title, fields, button = "সংরক্ষণ করুন") {
    return `
      <section class="panel">
        <h3>${esc(title)}</h3>
        <form class="data-form">
          ${fields}
          <button type="submit">${esc(button)}</button>
          <p class="form-message" aria-live="polite"></p>
        </form>
      </section>
    `;
  }

  async function addDocument(collection, data) {
    await db.collection(collection).add({
      ...data,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: currentUser.uid
    });
  }

  function attachForm(collection, transform = form => {
    const data = {};
    new FormData(form).forEach((value, key) => {
      data[key] = value;
    });
    return data;
  }) {
    document.querySelectorAll(".data-form").forEach(form => {
      form.onsubmit = async event => {
        event.preventDefault();

        const submit = form.querySelector('button[type="submit"]');
        const msg = form.querySelector(".form-message");

        submit.disabled = true;
        msg.textContent = "সংরক্ষণ হচ্ছে…";

        try {
          const data = transform(form);
          await addDocument(collection, data);
          msg.textContent = "তথ্য সফলভাবে সংরক্ষিত হয়েছে।";
          form.reset();
          await render();
        } catch (error) {
          console.error(error);
          msg.textContent =
            "সংরক্ষণ হয়নি: " + (error.code || "") + " " + error.message;
        } finally {
          submit.disabled = false;
        }
      };
    });
  }

  function dashboard(data) {
    const items = [
      ["শিক্ষার্থী", data.students.length],
      ["কোর্স", data.courses.length],
      ["সেশন", data.sessions.length],
      ["হাজিরা রেকর্ড", data.attendance.length],
      ["নোটিশ", data.notices.length],
      ["নম্বর রেকর্ড", data.marks.length]
    ];

    return `
      <div class="stats">
        ${items.map(([name, count]) => `
          <section class="stat-card">
            <p>${esc(name)}</p>
            <h2>${count}</h2>
          </section>
        `).join("")}
      </div>

      <section class="panel">
        <h3>স্বাগতম</h3>
        <p>AMC Economics Department Attendance App</p>
        <p>আজকের তারিখ: ${today()}</p>
        <p>আপনার ভূমিকা: ${roleBn(profile.role)}</p>
      </section>
    `;
  }

  function studentsPage(data) {
    let html = "";

    if (profile.role === "admin") {
      html += formCard(
        "নতুন শিক্ষার্থী যোগ করুন",
        field("নাম", "name") +
        field("রোল নম্বর", "roll") +
        field("শিক্ষাবর্ষ / সেশন", "session") +
        field("ইমেইল (ঐচ্ছিক)", "email", "email", false)
      );
    }

    html += `
      <section class="panel">
        <h3>শিক্ষার্থী তালিকা</h3>
        ${table(
          ["নাম", "রোল", "সেশন", "ইমেইল"],
          data.students.map(s => [
            s.name || "",
            s.roll || "",
            s.session || "",
            s.email || ""
          ])
        )}
      </section>
    `;

    return html;
  }

  function coursesPage(data) {
    let html = "";

    if (profile.role === "admin") {
      html += formCard(
        "নতুন কোর্স যোগ করুন",
        field("কোর্সের নাম", "name") +
        field("কোর্স কোড", "code") +
        field("বর্ষ", "year", "number") +
        field("ক্রেডিট", "credit", "number")
      );
    }

    html += `
      <section class="panel">
        <h3>কোর্স তালিকা</h3>
        ${table(
          ["কোর্সের নাম", "কোড", "বর্ষ", "ক্রেডিট"],
          data.courses.map(c => [
            c.name || "",
            c.code || "",
            c.year || "",
            c.credit || ""
          ])
        )}
      </section>
    `;

    return html;
  }

  function sessionsPage(data) {
    let html = "";

    if (profile.role === "admin") {
      html += formCard(
        "নতুন সেশন যোগ করুন",
        field("সেশনের নাম", "name") +
        field("শুরুর তারিখ", "startDate", "date") +
        field("শেষের তারিখ", "endDate", "date")
      );
    }

    html += `
      <section class="panel">
        <h3>সেশন তালিকা</h3>
        ${table(
          ["সেশন", "শুরুর তারিখ", "শেষের তারিখ"],
          data.sessions.map(s => [
            s.name || "",
            s.startDate || "",
            s.endDate || ""
          ])
        )}
      </section>
    `;

    return html;
  }

  function noticesPage(data) {
    let html = "";

    if (profile.role !== "student") {
      html += formCard(
        "নতুন নোটিশ",
        field("নোটিশের শিরোনাম", "title") +
        `<label class="field"><span>বিস্তারিত</span><textarea name="body" required></textarea></label>`
      );
    }

    html += `
      <section class="panel">
        <h3>নোটিশ বোর্ড</h3>
        ${data.notices.length ? data.notices.map(n => `
          <article class="notice-card">
            <h4>${esc(n.title || "নোটিশ")}</h4>
            <p>${esc(n.body || "")}</p>
          </article>
        `).join("") : "<p>এখনো কোনো নোটিশ নেই।</p>"}
      </section>
    `;

    return html;
}function attendancePage(data) {
    const students = data.students;

    let html = "";

    if (profile.role !== "student") {
      html += formCard(
        "হাজিরা এন্ট্রি",
        field("তারিখ", "date", "date") +
        field("কোর্স কোড", "courseCode") +
        field("শিক্ষার্থীর রোল", "roll") +
        selectField("উপস্থিতি", "status", [
          { value: "present", label: "উপস্থিত" },
          { value: "absent", label: "অনুপস্থিত" },
          { value: "late", label: "বিলম্বে উপস্থিত" }
        ])
      );
    }

    const records = profile.role === "student"
      ? data.attendance.filter(a => a.studentUid === currentUser.uid)
      : data.attendance;

    html += `
      <section class="panel">
        <h3>${profile.role === "student" ? "আমার হাজিরা" : "হাজিরা রিপোর্ট"}</h3>
        ${table(
          ["তারিখ", "রোল", "কোর্স", "অবস্থা"],
          records.map(a => [
            a.date || "",
            a.roll || "",
            a.courseCode || "",
            a.status === "present" ? "উপস্থিত" :
            a.status === "absent" ? "অনুপস্থিত" :
            a.status === "late" ? "বিলম্বে উপস্থিত" :
            a.status || ""
          ])
        )}
      </section>
    `;

    return html;
  }

  function marksPage(data) {
    let html = "";

    if (profile.role !== "student") {
      html += formCard(
        "নম্বর এন্ট্রি",
        field("শিক্ষার্থীর রোল", "roll") +
        field("কোর্স কোড", "courseCode") +
        field("পরীক্ষার নাম", "exam") +
        field("প্রাপ্ত নম্বর", "score", "number") +
        field("পূর্ণ নম্বর", "total", "number")
      );
    }

    const records = profile.role === "student"
      ? data.marks.filter(m => m.studentUid === currentUser.uid)
      : data.marks;

    html += `
      <section class="panel">
        <h3>${profile.role === "student" ? "আমার নম্বর" : "নম্বর তালিকা"}</h3>
        ${table(
          ["রোল", "কোর্স", "পরীক্ষা", "প্রাপ্ত নম্বর", "পূর্ণ নম্বর"],
          records.map(m => [
            m.roll || "",
            m.courseCode || "",
            m.exam || "",
            m.score ?? "",
            m.total ?? ""
          ])
        )}
      </section>
    `;

    return html;
  }

  function reportsPage(data) {
    const rows = data.students.map(student => {
      const records = data.attendance.filter(a =>
        String(a.roll || "") === String(student.roll || "")
      );

      const present = records.filter(a => a.status === "present").length;
      const total = records.length;
      const percent = total ? Math.round(present / total * 100) : 0;

      return [
        student.name || "",
        student.roll || "",
        total,
        present,
        percent + "%"
      ];
    });

    return `
      <section class="panel">
        <h3>শিক্ষার্থীদের হাজিরা রিপোর্ট</h3>
        ${table(
          ["নাম", "রোল", "মোট এন্ট্রি", "উপস্থিত", "শতকরা"],
          rows
        )}
        <button type="button" id="exportReport">CSV রিপোর্ট ডাউনলোড</button>
      </section>
    `;
  }

  function backupPage(data) {
    return `
      <section class="panel">
        <h3>ডেটা ব্যাকআপ</h3>
        <p>Firestore থেকে পাওয়া তথ্য JSON ফাইল হিসেবে ডাউনলোড করুন।</p>
        <button type="button" id="downloadBackup">JSON ব্যাকআপ ডাউনলোড</button>
      </section>
    `;
  }

  function exportCSV(data) {
    const rows = [
      ["Name", "Roll", "Total", "Present", "Percentage"],
      ...data.students.map(student => {
        const records = data.attendance.filter(a =>
          String(a.roll || "") === String(student.roll || "")
        );
        const present = records.filter(a => a.status === "present").length;
        const percent = records.length
          ? Math.round(present / records.length * 100)
          : 0;

        return [
          student.name || "",
          student.roll || "",
          records.length,
          present,
          percent + "%"
        ];
      })
    ];

    const csv = "\uFEFF" + rows.map(row =>
      row.map(value =>
        '"' + String(value).replace(/"/g, '""') + '"'
      ).join(",")
    ).join("\r\n");

    downloadFile(csv, "attendance-report.csv", "text/csv;charset=utf-8");
  }

  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  async function render() {
    if (!profile || !db) return;

    const content = $("content");
    if (!content) {
      console.error("HTML-এ id='content' পাওয়া যায়নি।");
      return;
    }

    content.innerHTML = "<p>তথ্য লোড হচ্ছে…</p>";

    try {
      const data = await getData();

      if (!profile) return;

      switch (active) {
        case "dashboard":
          content.innerHTML = dashboard(data);
          break;

        case "students":
          content.innerHTML = studentsPage(data);
          break;

        case "teachers":
          content.innerHTML = `
            <section class="panel">
              <h3>প্রোফাইল ও ব্যবহারকারী</h3>
              <p>নতুন শিক্ষক বা শিক্ষার্থী যোগ করতে Firebase Authentication-এ অ্যাকাউন্ট তৈরি করে profiles কালেকশনে UID-সহ role দিতে হবে।</p>
              ${table(
                ["নাম", "ইমেইল", "ভূমিকা"],
                data.profiles.map(p => [
                  p.name || "",
                  p.email || "",
                  roleBn(p.role || "")
                ])
              )}
            </section>
          `;
          break;

        case "courses":
          content.innerHTML = coursesPage(data);
          break;

        case "sessions":
          content.innerHTML = sessionsPage(data);
          break;

        case "attendance":
        case "myattendance":
          content.innerHTML = attendancePage(data);
          break;

        case "notices":
          content.innerHTML = noticesPage(data);
          break;

        case "marks":
        case "mymarks":
          content.innerHTML = marksPage(data);
          break;

        case "reports":
          content.innerHTML = reportsPage(data);
          break;

        case "backup":
          content.innerHTML = backupPage(data);
          break;

        default:
          content.innerHTML = dashboard(data);
      }

      attachForm(active === "students" ? "students" :
        active === "courses" ? "courses" :
        active === "sessions" ? "sessions" :
        active === "notices" ? "notices" :
        active === "attendance" ? "attendance" :
        active === "marks" ? "marks" : "");

      if (active === "attendance") {
        const form = content.querySelector(".data-form");

        if (form) {
          const dateInput = form.querySelector('[name="date"]');
          if (dateInput) dateInput.value = today();

          form.onsubmit = async event => {
            event.preventDefault();

            const values = new FormData(form);
            const roll = String(values.get("roll") || "").trim();
            const student = data.students.find(s =>
              String(s.roll || "") === roll
            );

            if (!student) {
              form.querySelector(".form-message").textContent =
                "এই রোলের শিক্ষার্থী তালিকায় পাওয়া যায়নি।";
              return;
            }

            try {
              await addDocument("attendance", {
                date: values.get("date"),
                courseCode: values.get("courseCode"),
                roll,
                studentUid: student.uid || "",
                status: values.get("status")
              });

              form.querySelector(".form-message").textContent =
                "হাজিরা সংরক্ষিত হয়েছে।";

              await render();
            } catch (error) {
              form.querySelector(".form-message").textContent =
                "সমস্যা: " + error.message;
            }
          };
        }
      }

      if (active === "marks") {
        const form = content.querySelector(".data-form");

        if (form) {
          form.onsubmit = async event => {
            event.preventDefault();

            const values = new FormData(form);
            const roll = String(values.get("roll") || "").trim();
            const student = data.students.find(s =>
              String(s.roll || "") === roll
            );

            if (!student) {
              form.querySelector(".form-message").textContent =
                "এই রোলের শিক্ষার্থী তালিকায় পাওয়া যায়নি।";
              return;
            }

            const score = Number(values.get("score"));
            const total = Number(values.get("total"));

            if (
              !Number.isFinite(score) ||
              !Number.isFinite(total) ||
              score < 0 ||
              total <= 0 ||
              score > total
            ) {
              form.querySelector(".form-message").textContent =
                "নম্বর সঠিকভাবে দিন। প্রাপ্ত নম্বর পূর্ণ নম্বরের বেশি হতে পারবে না।";
              return;
            }

            try {
              await addDocument("marks", {
                roll,
                studentUid: student.uid || "",
                courseCode: values.get("courseCode"),
                exam: values.get("exam"),
                score,
                total
              });

              form.querySelector(".form-message").textContent =
                "নম্বর সংরক্ষিত হয়েছে।";

              await render();
            } catch (error) {
              form.querySelector(".form-message").textContent =
                "সমস্যা: " + error.message;
            }
          };
        }
      }

      const exportButton = $("exportReport");
      if (exportButton) {
        exportButton.onclick = () => exportCSV(data);
      }

      const backupButton = $("downloadBackup");
      if (backupButton) {
        backupButton.onclick = () => {
          downloadFile(
            JSON.stringify(data, null, 2),
            "amc-attendance-backup.json",
            "application/json"
          );
        };
      }

    } catch (error) {
      console.error(error);
      content.innerHTML =
        `<section class="panel"><h3>তথ্য লোড করা যায়নি</h3><p>${esc(error.message)}</p></section>`;
    }
  }

  document.addEventListener("DOMContentLoaded", initializeFirebase);
})();
