/* AMC Attendance — Firebase Auth + Firestore
   All authorization must be enforced again in Firestore Security Rules.
*/
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const config = window.AMC_FIREBASE_CONFIG || {};
  const configured = config.apiKey && !config.apiKey.startsWith("PASTE_") &&
                     config.projectId && !config.projectId.startsWith("PASTE_") &&
                     config.appId && !config.appId.startsWith("PASTE_");
  let auth, db, currentUser = null, profile = null, active = "dashboard";
  const tabs = {
    admin: [["dashboard","ড্যাশবোর্ড"],["students","শিক্ষার্থী"],["teachers","শিক্ষক"],["courses","কোর্স"],["sessions","সেশন"],["attendance","হাজিরা"],["notices","নোটিশ"],["marks","নম্বর"],["reports","রিপোর্ট"],["backup","ব্যাকআপ"]],
    teacher: [["dashboard","ড্যাশবোর্ড"],["students","শিক্ষার্থী তালিকা"],["attendance","হাজিরা নেওয়া"],["notices","নোটিশ"],["marks","নম্বর"],["reports","রিপোর্ট"]],
    student: [["dashboard","ড্যাশবোর্ড"],["myattendance","আমার হাজিরা"],["notices","নোটিশ"],["mymarks","আমার নম্বর"]]
  };
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const today = () => new Date().toLocaleDateString("en-CA");
  const msg = (s, error=false) => { $("loginMsg").textContent=s; $("loginMsg").style.color=error?"var(--danger)":"#15803d"; };
  const notice = s => { $("setupNotice").textContent=s; $("setupNotice").classList.remove("hidden"); };
  const showErr = e => alert(e?.message || String(e));
  if (!configured) notice("সেটআপ বাকি: config.js ফাইলে Firebase Web App config বসাও, Firebase Authentication-এ Email/Password চালু করো এবং firestore.rules প্রকাশ করো।");
  else {
    try { firebase.initializeApp(config); auth=firebase.auth(); db=firebase.firestore(); auth.onAuthStateChanged(loadProfile); }
    catch(e) { notice("Firebase শুরু করা যায়নি: "+e.message); }
  }
  $("themeBtn").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("amc-theme",document.body.classList.contains("dark")?"dark":"light");};
  if(localStorage.getItem("amc-theme")==="dark") document.body.classList.add("dark");
  $("loginForm").onsubmit=async e=>{e.preventDefault();if(!auth){msg("আগে config.js সেটআপ করতে হবে।",true);return;}msg("লগইন হচ্ছে…");try{await auth.signInWithEmailAndPassword($("email").value.trim(),$("password").value);}catch(err){msg("লগইন হয়নি: "+err.message,true);}};
  $("logoutBtn").onclick=()=>auth?.signOut();
  async function loadProfile(user){
    currentUser=user; profile=null;
    if(!user){$("app").classList.add("hidden");$("loginCard").classList.remove("hidden");return;}
    try{
      const snap=await db.collection("profiles").doc(user.uid).get();
      if(!snap.exists){await auth.signOut();msg("এই অ্যাকাউন্টের profile নেই। Admin-কে profile ও role তৈরি করতে বলুন।",true);return;}
      profile=snap.data();
      if(!["admin","teacher","student"].includes(profile.role)){await auth.signOut();msg("অনুমোদিত role নেই।",true);return;}
      $("loginCard").classList.add("hidden");$("app").classList.remove("hidden");
      $("welcomeTitle").textContent=(profile.name||user.email)+" — "+roleBn(profile.role);
      $("userLine").textContent=user.email+" · "+roleBn(profile.role);
      buildNav(); await render();
    }catch(e){showErr(e);await auth.signOut();}
  }
  function roleBn(r){return ({admin:"অ্যাডমিন",teacher:"শিক্ষক",student:"শিক্ষার্থী"})[r]||r;}
  function buildNav(){
    $("nav").innerHTML=(tabs[profile.role]||[]).map(([id,label])=>`<button data-tab="${id}" class="${id===active?"active":""}">${label}</button>`).join("");
    $("nav").querySelectorAll("button").forEach(b=>b.onclick=async()=>{active=b.dataset.tab;buildNav();await render();});
  }
  async function all(col){const s=await db.collection(col).orderBy("createdAt","desc").limit(500).get().catch(()=>db.collection(col).limit(500).get());return s.docs.map(d=>({id:d.id,...d.data()}));}
  async function add(col,data){data.createdAt=firebase.firestore.FieldValue.serverTimestamp();data.createdBy=currentUser.uid;await db.collection(col).add(data);}
  async function render(){
    const v=$("view");v.innerHTML="<p>লোড হচ্ছে…</p>";
    try{
      if(active==="dashboard"){const [students,attendance,courses,notices]=await Promise.all([all("students"),all("attendance"),all("courses"),all("notices")]);v.innerHTML=`<h2>ড্যাশবোর্ড</h2><div class="grid">${stat("শিক্ষার্থী",students.length)}${stat("হাজিরা রেকর্ড",attendance.length)}${stat("কোর্স",courses.length)}${stat("নোটিশ",notices.length)}</div><p class="small">ডেটা Firebase থেকে লোড হচ্ছে। আপনার role অনুযায়ী অনুমতি প্রযোজ্য।</p>`;return;}
      if(active==="students"){const rows=await all("students");v.innerHTML=`<h2>শিক্ষার্থী</h2>${profile.role==="admin"?`<form id="addStudent" class="inline-form"><label>নাম<input name="name" required></label><label>রোল/আইডি<input name="studentId" required></label><label>বিভাগ<input name="department" value="Economics"></label><label>সেশন<input name="session" placeholder="2024-25"></label><button>যোগ করুন</button></form>`:""}${table(["নাম","রোল/আইডি","বিভাগ","সেশন"],rows.map(x=>[x.name,x.studentId,x.department,x.session]))}`;form("addStudent",async d=>{await add("students",d);await render();});return;}
      if(active==="teachers"){const rows=await all("profiles");v.innerHTML=`<h2>শিক্ষক/ব্যবহারকারী</h2><p class="small">নিরাপত্তার কারণে এই প্যানেল থেকে Auth account তৈরি হয় না। Firebase Authentication-এ account তৈরি করে UID-সহ profiles collection-এ role নির্ধারণ করতে হবে।</p>${table(["নাম","ইমেইল","Role"],rows.map(x=>[x.name,x.email,x.role]))}`;return;}
      if(active==="courses"){const rows=await all("courses");v.innerHTML=`<h2>কোর্স</h2>${profile.role==="admin"?`<form id="addCourse" class="inline-form"><label>কোর্স কোড<input name="code" required></label><label>কোর্সের নাম<input name="name" required></label><label>শিক্ষক UID<input name="teacherUid"></label><button>কোর্স যোগ</button></form>`:""}${table(["কোড","কোর্স","শিক্ষক UID"],rows.map(x=>[x.code,x.name,x.teacherUid]))}`;form("addCourse",async d=>{await add("courses",d);await render();});return;}
      if(active==="sessions"){const rows=await all("sessions");v.innerHTML=`<h2>সেশন</h2>${profile.role==="admin"?`<form id="addSession" class="inline-form"><label>সেশনের নাম<input name="name" required placeholder="2024-25"></label><label>শুরু<input name="startDate" type="date"></label><label>শেষ<input name="endDate" type="date"></label><button>সেশন যোগ</button></form>`:""}${table(["সেশন","শুরু","শেষ"],rows.map(x=>[x.name,x.startDate,x.endDate]))}`;form("addSession",async d=>{await add("sessions",d);await render();});return;}
      if(active==="attendance"){const students=await all("students"),courses=await all("courses"),rows=await all("attendance");v.innerHTML=`<h2>হাজিরা</h2><form id="takeAttendance" class="inline-form"><label>শিক্ষার্থী<select name="studentRef" required>${students.map(s=>`<option value="${esc(s.id)}">${esc(s.name)} (${esc(s.studentId)})</option>`).join("")}</select></label><label>কোর্স<select name="courseRef"><option value="">সাধারণ</option>${courses.map(c=>`<option value="${esc(c.id)}">${esc(c.code)} - ${esc(c.name)}</option>`).join("")}</select></label><label>তারিখ<input type="date" name="date" value="${today()}" required></label><label>অবস্থা<select name="status"><option>Present</option><option>Absent</option><option>Late</option></select></label><button>হাজিরা সংরক্ষণ</button></form>${table(["তারিখ","শিক্ষার্থী","কোর্স","অবস্থা"],rows.map(x=>[x.date,x.studentName,x.courseName||"সাধারণ",x.status]))}`;form("takeAttendance",async d=>{const s=students.find(x=>x.id===d.studentRef),c=courses.find(x=>x.id===d.courseRef);if(!s)throw Error("আগে শিক্ষার্থী যোগ করুন");const dup=await db.collection("attendance").where("studentRef","==",s.id).where("date","==",d.date).get();if(!dup.empty)throw Error("এই তারিখে এই শিক্ষার্থীর হাজিরা আগে আছে");await add("attendance",{...d,studentName:s.name,studentId:s.studentId,courseName:c?.name||"",teacherUid:currentUser.uid});await render();});return;}
      if(active==="myattendance"){const rows=await all("attendance");const mine=rows.filter(x=>x.studentUid===currentUser.uid||x.studentRef===profile.studentRef);v.innerHTML=`<h2>আমার হাজিরা</h2>${table(["তারিখ","কোর্স","অবস্থা"],mine.map(x=>[x.date,x.courseName||"সাধারণ",x.status]))}`;return;}
      if(active==="notices"){const rows=await all("notices");v.innerHTML=`<h2>নোটিশ</h2>${profile.role!=="student"?`<form id="addNotice"><label>শিরোনাম<input name="title" required></label><label>বিস্তারিত<textarea name="body" required></textarea></label><button class="primary">নোটিশ প্রকাশ</button></form>`:""}${rows.map(x=>`<article class="stat"><h3>${esc(x.title)}</h3><p>${esc(x.body)}</p><small>${esc(x.authorName||"AMC")}</small></article>`).join("")||'<p class="empty">এখনো কোনো নোটিশ নেই।</p>'}`;form("addNotice",async d=>{d.authorName=profile.name||currentUser.email;await add("notices",d);await render();});return;}
      if(active==="marks"){const students=await all("students"),rows=await all("marks");v.innerHTML=`<h2>নম্বর</h2><form id="addMark" class="inline-form"><label>শিক্ষার্থী<select name="studentRef">${students.map(s=>`<option value="${esc(s.id)}">${esc(s.name)} (${esc(s.studentId)})</option>`).join("")}</select></label><label>বিষয়/কোর্স<input name="courseName" required></label><label>নম্বর<input name="score" type="number" min="0" required></label><button>নম্বর যোগ</button></form>${table(["শিক্ষার্থী","কোর্স","নম্বর"],rows.map(x=>[x.studentName,x.courseName,x.score]))}`;form("addMark",async d=>{const s=students.find(x=>x.id===d.studentRef);if(!s)throw Error("আগে শিক্ষার্থী যোগ করুন");await add("marks",{...d,studentName:s.name,studentUid:s.uid||"",teacherUid:currentUser.uid,score:Number(d.score)});await render();});return;}
      if(active==="mymarks"){const rows=await all("marks");v.innerHTML=`<h2>আমার নম্বর</h2>${table(["কোর্স","নম্বর"],rows.filter(x=>x.studentUid===currentUser.uid||x.studentRef===profile.studentRef).map(x=>[x.courseName,x.score]))}`;return;}
      if(active==="reports"){const rows=await all("attendance");const csv="তারিখ,শিক্ষার্থী,রোল,কোর্স,অবস্থা\\n"+rows.map(x=>[x.date,x.studentName,x.studentId,x.courseName,x.status].map(csvCell).join(",")).join("\\n");v.innerHTML=`<h2>রিপোর্ট</h2><p>মোট হাজিরা রেকর্ড: <b>${rows.length}</b></p><button id="exportCsv">CSV ডাউনলোড</button>${table(["তারিখ","শিক্ষার্থী","রোল","অবস্থা"],rows.map(x=>[x.date,x.studentName,x.studentId,x.status]))}`;$("exportCsv").onclick=()=>download("attendance.csv","\\ufeff"+csv,"text/csv;charset=utf-8");return;}
      if(active==="backup"){if(profile.role!=="admin"){v.innerHTML="<p>এই প্যানেল শুধু অ্যাডমিনের জন্য।</p>";return;}v.innerHTML=`<h2>ব্যাকআপ ও রিস্টোর</h2><p>ব্যাকআপে শিক্ষার্থী, কোর্স, সেশন, হাজিরা, নোটিশ ও নম্বর থাকবে। JSON ফাইল নিরাপদে রাখুন।</p><div class="actions"><button id="backupBtn">Backup ডাউনলোড</button><label class="small">JSON ব্যাকআপ বেছে নিন<input id="restoreFile" type="file" accept=".json,application/json"></label></div><p class="small">Restore নতুন রেকর্ড যোগ করবে; বিদ্যমান রেকর্ড মুছে ফেলবে না।</p>`;$("backupBtn").onclick=backup;$("restoreFile").onchange=restore;return;}
      v.innerHTML="<h2>পেজ পাওয়া যায়নি</h2>";
    }catch(e){v.innerHTML=`<h2>তথ্য লোড হয়নি</h2><p class="message">${esc(e.message)}</p><p class="small">Firebase Console-এর Firestore Rules ও user role পরীক্ষা করুন।</p>`;}
  }
  function stat(name,n){return `<div class="stat"><span>${name}</span><b>${n}</b></div>`;}
  function table(head,rows){if(!rows.length)return '<p class="empty">কোনো তথ্য পাওয়া যায়নি।</p>';return `<div class="table-wrap"><table><thead><tr>${head.map(x=>`<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(x=>`<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;}
  function form(id,callback){const f=$(id);if(!f)return;f.onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(f).entries());const btn=f.querySelector("button");btn.disabled=true;try{await callback(d);}catch(err){alert(err.message||String(err));}finally{if(btn)btn.disabled=false;}};}
  function csvCell(x){return '"'+String(x??"").replace(/"/g,'""')+'"';}
  function download(name,content,type){const a=document.createElement("a"),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
  async function backup(){try{const out={format:"AMC-Attendance-Backup-v1",exportedAt:new Date().toISOString(),collections:{}};for(const c of ["students","courses","sessions","attendance","notices","marks"]){out.collections[c]=(await all(c)).map(({id,...d})=>({id,...d}));}download("amc-attendance-backup.json",JSON.stringify(out,null,2),"application/json");}catch(e){showErr(e);}}
  async function restore(ev){const f=ev.target.files?.[0];if(!f)return;if(!confirm("ব্যাকআপের রেকর্ডগুলো যোগ করবেন?")){ev.target.value="";return;}try{const data=JSON.parse(await f.text());if(data.format!=="AMC-Attendance-Backup-v1"||!data.collections)throw Error("সঠিক AMC JSON ব্যাকআপ নয়");for(const [col,items] of Object.entries(data.collections)){if(!["students","courses","sessions","attendance","notices","marks"].includes(col))continue;for(const item of items||[]){const {id,...d}=item;await db.collection(col).add({...d,restoredAt:firebase.firestore.FieldValue.serverTimestamp(),restoredBy:currentUser.uid});}}alert("Restore সম্পন্ন হয়েছে।");await render();}catch(e){showErr(e);}finally{ev.target.value="";}}
})();
