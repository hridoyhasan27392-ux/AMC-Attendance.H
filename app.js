/* AMC Attendance: Firebase Auth + Cloud Firestore. */
(() => {
  const $ = id => document.getElementById(id);
  const main = $('main');
  const statusBar = $('statusBar');
  let auth = null, db = null, currentUser = null, currentProfile = null;
  let currentPage = 'home';
  const COLLECTIONS = ['profiles','students','sessions','courses','notices','attendance','marks'];
  const config = window.AMC_FIREBASE_CONFIG || {};
  const configReady = config.apiKey && !String(config.apiKey).includes('PASTE_') && config.projectId && !String(config.projectId).includes('YOUR_');

  if (configReady && window.firebase) {
    try {
      if (!firebase.apps.length) firebase.initializeApp(config);
      auth = firebase.auth(); db = firebase.firestore();
      auth.onAuthStateChanged(async user => {
        currentUser = user;
        currentProfile = null;
        if (user) {
          try {
            const snap = await db.collection('profiles').doc(user.uid).get();
            if (snap.exists) currentProfile = { uid: user.uid, ...snap.data() };
            if (!currentProfile) {
              showMessage('তোমার অ্যাকাউন্টের profiles তথ্য পাওয়া যায়নি। অ্যাডমিনকে UID দিয়ে প্রোফাইল তৈরি করতে বলো।', 'error');
              renderHome(); return;
            }
            setStatus(`${currentProfile.name || user.email} • ${roleName(currentProfile.role)} হিসেবে লগইন`, 'success');
            renderHome();
          } catch (e) { showMessage(errorText(e), 'error'); renderHome(); }
        } else {
          setStatus('লগইন করা হয়নি', ''); renderHome();
        }
      });
    } catch (e) { setStatus('Firebase চালু করা যায়নি: ' + e.message, 'error'); }
  } else {
    setStatus('Firebase config.js-এ নিজের Firebase Web App config বসাতে হবে।', 'error');
  }

  document.querySelectorAll('[data-role]').forEach(b => b.addEventListener('click', () => openLogin(b.dataset.role)));
  $('themeButton').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    $('themeButton').textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
  });
  $('startStudent').addEventListener('click', () => openLogin('student'));

  function roleName(role) { return ({admin:'অ্যাডমিন', teacher:'শিক্ষক', student:'শিক্ষার্থী'})[role] || 'ব্যবহারকারী'; }
  function setStatus(text, cls='') { statusBar.textContent = text || ''; statusBar.className = 'status-bar ' + cls; }
  function showMessage(text, cls='') {
    let m = $('pageMessage');
    if (!m) { m = document.createElement('div'); m.id = 'pageMessage'; m.className = 'message'; main.appendChild(m); }
    m.textContent = text; m.className = 'message ' + cls;
  }
  function errorText(e) {
    const code = e && e.code;
    const map = {
      'auth/invalid-credential':'ইমেইল বা পাসওয়ার্ড সঠিক নয়।', 'auth/user-not-found':'এই ইমেইলে অ্যাকাউন্ট পাওয়া যায়নি।',
      'auth/wrong-password':'পাসওয়ার্ড সঠিক নয়।', 'auth/invalid-email':'সঠিক ইমেইল লিখুন।',
      'auth/too-many-requests':'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।',
      'permission-denied':'অনুমতি নেই। Firestore Rules ও লগইন রোল পরীক্ষা করো।',
      'unavailable':'ইন্টারনেট বা Firebase সার্ভারে সমস্যা হচ্ছে।'
    };
    return map[code] || (e && e.message) || 'একটি সমস্যা হয়েছে।';
  }
  function clear(title, desc='') {
    main.replaceChildren();
    if (title) main.append(make('h1', {}, title));
    if (desc) main.append(make('p', {className:'subtitle'}, desc));
  }
  function make(tag, attrs={}, text='') {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v]) => {
      if (k === 'className') node.className = v;
      else if (k === 'textContent') node.textContent = v;
      else node.setAttribute(k,v);
    });
    if (text !== '') node.textContent = text;
    return node;
  }
  function addButton(parent, label, fn, cls='') {
    const b = make('button',{type:'button',className:'submit '+cls},label);
    b.addEventListener('click',fn); parent.appendChild(b); return b;
  }
  function addField(parent, label, id, type='text', opts={}) {
    const wrap = make('div',{className:'field '+(opts.full?'full':'')});
    wrap.append(make('label',{for:id},label));
    let input;
    if (type === 'textarea') input = make('textarea',{id,required:opts.required===false?null:'required',placeholder:opts.placeholder||''});
    else if (type === 'select') {
      input = make('select',{id,required:opts.required===false?null:'required'});
      (opts.options||[]).forEach(([v,t]) => input.append(make('option',{value:v},t)));
    } else input = make('input',{id,type,required:opts.required===false?null:'required',placeholder:opts.placeholder||'',...(opts.attrs||{})});
    if (opts.required === false) input.removeAttribute('required');
    wrap.append(input); parent.append(wrap); return input;
  }
  function addForm(fields, submitLabel, callback) {
    const f = make('form',{className:'form-grid'});
    fields.forEach(x => addField(f,x.label,x.id,x.type||'text',x));
    const actions = make('div',{className:'full'});
    const b = make('button',{type:'submit',className:'submit'},submitLabel); actions.append(b); f.append(actions);
    f.addEventListener('submit', async e => { e.preventDefault(); b.disabled=true; b.textContent='অপেক্ষা করুন…'; try { await callback(f); } catch(err) { showMessage(errorText(err),'error'); } finally { b.disabled=false; b.textContent=submitLabel; } });
    main.append(f); return f;
  }
  function value(id) { const n=$(id); return n ? n.value.trim() : ''; }
  function requireRole(...roles) {
    if (!currentUser || !currentProfile) { openLogin('student'); return false; }
    if (!roles.includes(currentProfile.role)) { showMessage('এই কাজের অনুমতি তোমার নেই।','error'); return false; }
    return true;
  }
  function openLogin(role) {
    currentPage='login'; clear(roleName(role)+' লগইন','Firebase ইমেইল ও পাসওয়ার্ড ব্যবহার করো।');
    if (!auth) { showMessage('আগে config.js ফাইলে Firebase Web App config বসাও।','error'); return; }
    addForm([
      {label:'ইমেইল',id:'loginEmail',type:'email',full:true},
      {label:'পাসওয়ার্ড',id:'loginPassword',type:'password',full:true}
    ],'লগইন',async () => {
      await auth.signInWithEmailAndPassword(value('loginEmail'),value('loginPassword'));
      const user=auth.currentUser;
      const snap=await db.collection('profiles').doc(user.uid).get();
      if (!snap.exists) { await auth.signOut(); throw new Error('profiles collection-এ এই UID-এর প্রোফাইল নেই।'); }
      const p=snap.data();
      if (p.role !== role) { await auth.signOut(); throw new Error('এই অ্যাকাউন্টটি '+roleName(p.role)+'; '+roleName(role)+' নয়। সঠিক মেনু ব্যবহার করো।'); }
    });
    addButton(main,'ফিরে যাও',renderHome,'secondary');
  }
  async function logout() { if (auth) await auth.signOut(); currentProfile=null; currentUser=null; renderHome(); }
  function renderHome() {
    currentPage='home'; clear('হাজিরা দিন','AMC Economics Department Attendance Management System');
    main.prepend(make('div',{className:'paper'},'📝'));
    if (!currentUser || !currentProfile) {
      main.append(make('p',{className:'hint'},'প্রকৃত হাজিরা ও তথ্য সংরক্ষণের জন্য Firebase অ্যাকাউন্ট দিয়ে লগইন করুন।'));
      addButton(main,'শিক্ষার্থী লগইন',()=>openLogin('student'));
      addButton(main,'অ্যাডমিন লগইন',()=>openLogin('admin'),'secondary');
      addButton(main,'শিক্ষক লগইন',()=>openLogin('teacher'),'secondary');
      addNoticesPreview(); return;
    }
    const p=currentProfile;
    main.append(make('p',{className:'subtitle'},`${p.name||currentUser.email} • ${roleName(p.role)}`));
    if (p.role==='student') {
      addButton(main,'📝 হাজিরা দিন',attendancePage);
      addButton(main,'📊 আমার হাজিরা',myAttendance,'secondary');
      addButton(main,'🧮 আমার নম্বর',myMarks,'secondary');
      addButton(main,'📚 আমার কোর্স',myCourses,'secondary');
    } else {
      addButton(main,'⚙️ অ্যাডমিন প্যানেল',adminPage);
      addButton(main,'👨‍🏫 শিক্ষক প্যানেল',teacherPage,'secondary');
      addButton(main,'📚 কোর্স ম্যাপিং',coursesPage,'secondary');
      addButton(main,'📅 সেশন',sessionsPage,'secondary');
      addButton(main,'📢 নোটিশ',noticesPage,'secondary');
      addButton(main,'📊 রিপোর্ট / লাইভ রিপোর্ট / Tracking',reportPage,'secondary');
      addButton(main,'✍️ ম্যানুয়াল হাজিরা',manualPage,'secondary');
      addButton(main,'🧮 নম্বর এন্ট্রি',marksPage,'secondary');
      addButton(main,'💾 Backup / Restore',backupPage,'secondary');
    }
    addButton(main,'🚪 লগআউট',logout,'danger');
    addNoticesPreview();
  }
  async function addNoticesPreview() {
    if (!db) return;
    try {
      const snap=await db.collection('notices').orderBy('createdAt','desc').limit(5).get();
      if (snap.empty) return;
      const section=make('section'); section.append(make('h2',{},'📢 সর্বশেষ নোটিশ'));
      snap.forEach(doc=>{const n=doc.data();const box=make('div',{className:'notice'});box.append(make('strong',{},n.title||'নোটিশ'));box.append(make('p',{},n.body||''));section.append(box);});
      main.append(section);
    } catch(e) { /* home stays usable if no notice permission or connection */ }
  }
  async function adminPage() {
    if(!requireRole('admin')) return; currentPage='admin'; clear('⚙️ অ্যাডমিন প্যানেল','শিক্ষার্থী/স্টাফের Firebase Auth অ্যাকাউন্ট আগে Console থেকে তৈরি করতে হবে; এখানে UID-এর সঙ্গে প্রোফাইল যুক্ত হবে।');
    addForm([
      {label:'Firebase Auth UID',id:'profileUid',full:true,placeholder:'Authentication → Users থেকে UID কপি করো'},
      {label:'নাম',id:'profileName'},
      {label:'রোল',id:'profileRole',type:'select',options:[['student','শিক্ষার্থী'],['teacher','শিক্ষক'],['admin','অ্যাডমিন']]},
      {label:'ইমেইল (ঐচ্ছিক)',id:'profileEmail',type:'email',required:false},
      {label:'শিক্ষার্থী রোল (শুধু শিক্ষার্থী)',id:'profileRoll',required:false},
      {label:'সেশন (যেমন 2024-25)',id:'profileSession',required:false},
      {label:'বিভাগ/বিষয়',id:'profileDepartment',required:false}
    ],'প্রোফাইল সংরক্ষণ',async()=>{
      const uid=value('profileUid'); if(!uid) throw new Error('UID প্রয়োজন।');
      const role=value('profileRole');
      const profile={name:value('profileName'),role,email:value('profileEmail'),department:value('profileDepartment'),roll:value('profileRoll'),session:value('profileSession'),updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
      await db.collection('profiles').doc(uid).set(profile,{merge:true});
      if(role==='student') await db.collection('students').doc(uid).set({uid,name:profile.name,email:profile.email,roll:value('profileRoll'),session:value('profileSession'),department:profile.department,createdAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
      showMessage('প্রোফাইল সংরক্ষিত হয়েছে।','success'); adminPage();
    });
    addButton(main,'সব প্রোফাইল দেখুন',profilesList,'secondary');
    addButton(main,'শিক্ষার্থীর তালিকা',studentsList,'secondary');
  }
  async function profilesList() {
    if(!requireRole('admin')) return; clear('👥 প্রোফাইল তালিকা'); const snap=await db.collection('profiles').get();
    renderDocs(snap, d=>`${d.name||'নাম নেই'} — ${roleName(d.role)} — UID: ${d.id}`, async doc=>{if(!confirm('এই প্রোফাইলের রোল student করতে চাও?'))return; await db.collection('profiles').doc(doc.id).update({role:'student'}); profilesList();});
  }
  async function studentsList() {
    if(!requireRole('admin','teacher')) return; clear('🎓 শিক্ষার্থীর তালিকা'); const snap=await db.collection('students').orderBy('roll').get();
    renderDocs(snap,d=>`${d.name||''} — রোল ${d.roll||'—'} — সেশন ${d.session||'—'} — UID ${d.uid||d.id}`);
  }
  function renderDocs(snap,formatter,removeFn) {
    const list=make('div',{className:'data-list'}); if(snap.empty) list.append(make('p',{},'কোনো তথ্য নেই।'));
    snap.forEach(doc=>{const row=make('div',{className:'data-row'});row.append(make('p',{},formatter({...doc.data(),id:doc.id}))); if(removeFn){const b=make('button',{className:'submit danger'},'রোল পরিবর্তন');b.addEventListener('click',()=>removeFn(doc));row.append(b);}list.append(row);}); main.append(list);
  }
  function teacherPage() {
    if(!requireRole('admin','teacher')) return; clear('👨‍🏫 শিক্ষক প্যানেল','দ্রুত কাজের তালিকা');
    addButton(main,'হাজিরা রিপোর্ট',reportPage); addButton(main,'ম্যানুয়াল হাজিরা',manualPage,'secondary'); addButton(main,'নম্বর এন্ট্রি',marksPage,'secondary'); addButton(main,'কোর্স ম্যাপিং',coursesPage,'secondary'); addButton(main,'সেশন তৈরি',sessionsPage,'secondary');
  }
  async function attendancePage() {
    if(!requireRole('student')) return; currentPage='attendance'; clear('📝 হাজিরা দিন','শিক্ষকের দেওয়া সক্রিয় সেশনের ৪-ডিজিটের PIN লিখুন।');
    addForm([{label:'৪ ডিজিটের PIN',id:'attendancePin',type:'password',full:true,attrs:{inputmode:'numeric',maxlength:'4',pattern:'[0-9]{4}'}}],'হাজিরা জমা দিন',async()=>{
      const pin=value('attendancePin'); if(!/^\d{4}$/.test(pin)) throw new Error('সঠিক ৪ ডিজিটের PIN লিখুন।');
      const sessions=await db.collection('sessions').where('active','==',true).get();
      if(sessions.empty) throw new Error('এখন কোনো সক্রিয় সেশন নেই।');
      const today=localDate(); let submitted=false; let duplicate=false;
      for (const doc of sessions.docs) {
        const s=doc.data(); const id=`${currentUser.uid}_${today}_${doc.id}`; const ref=db.collection('attendance').doc(id);
        const existing=await ref.get(); if(existing.exists){duplicate=true;continue;}
        try {
          await ref.set({studentUid:currentUser.uid,studentName:currentProfile.name||'',roll:currentProfile.roll||'',session:currentProfile.session||'',sessionId:doc.id,sessionTitle:s.title||s.session||'ক্লাস',date:today,time:new Date().toLocaleTimeString('en-GB'),status:'উপস্থিত',pinAttempt:pin,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
          submitted=true; break;
        } catch (err) { if(err.code!=='permission-denied') throw err; }
      }
      if(!submitted) throw new Error(duplicate?'এই সেশনে আজকের হাজিরা আগেই জমা হয়েছে।':'PIN মেলেনি অথবা কোনো সক্রিয় সেশন নেই।');
      showMessage('হাজিরা সফলভাবে জমা হয়েছে!','success'); attendancePage();
    });
  }
  function localDate(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  async function sessionsPage() {
    if(!requireRole('admin','teacher'))return; clear('📅 সেশন','সেশন তৈরি করলে শিক্ষার্থীরা সক্রিয় PIN দিয়ে হাজিরা দিতে পারবে।');
    addForm([
      {label:'সেশন/ক্লাসের নাম',id:'sessionTitle',full:true,placeholder:'যেমন: Microeconomics — Class 01'},
      {label:'একাডেমিক সেশন',id:'sessionAcademic',placeholder:'2024-25'},
      {label:'হাজিরার ৪-ডিজিট PIN',id:'sessionPin',type:'text',attrs:{inputmode:'numeric',maxlength:'4',pattern:'[0-9]{4}'}},
      {label:'তারিখ',id:'sessionDate',type:'date'},
      {label:'অবস্থা',id:'sessionActive',type:'select',options:[['true','সক্রিয়'],['false','বন্ধ']]}
    ],'সেশন সংরক্ষণ',async()=>{
      if(!/^\d{4}$/.test(value('sessionPin')))throw new Error('PIN অবশ্যই ৪ ডিজিটের হতে হবে।');
      const sessionRef=db.collection('sessions').doc();
      await sessionRef.set({title:value('sessionTitle'),session:value('sessionAcademic'),date:value('sessionDate')||localDate(),active:value('sessionActive')==='true',createdAt:firebase.firestore.FieldValue.serverTimestamp(),createdBy:currentUser.uid});
      await db.collection('sessionPins').doc(sessionRef.id).set({attendancePin:value('sessionPin'),createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      showMessage('সেশন তৈরি হয়েছে। PIN শিক্ষার্থীদের জানাও।','success'); sessionsPage();
    });
    const snap=await db.collection('sessions').orderBy('createdAt','desc').get();
    if(snap.empty) main.append(make('p',{},'এখনো কোনো সেশন তৈরি করা হয়নি।'));
    for (const doc of snap.docs) {
      const d=doc.data(); const pinSnap=await db.collection('sessionPins').doc(doc.id).get();
      const row=make('div',{className:'data-row'});
      row.append(make('p',{},`${d.title||'সেশন'} — ${d.session||''} — ${d.active?'সক্রিয়':'বন্ধ'} — ${d.date||''}`));
      row.append(make('p',{className:'pill'},`PIN: ${pinSnap.exists ? pinSnap.data().attendancePin : 'পাওয়া যায়নি'}`));
      const b=make('button',{className:'submit secondary'},d.active?'সেশন বন্ধ করুন':'সেশন চালু করুন');
      b.addEventListener('click',async()=>{await db.collection('sessions').doc(doc.id).update({active:!d.active});sessionsPage();});
      row.append(b); main.append(row);
    }
  }
  async function noticesPage() {
    if(!requireRole('admin','teacher'))return; clear('📢 নোটিশ');
    addForm([{label:'নোটিশের শিরোনাম',id:'noticeTitle',full:true},{label:'বিস্তারিত',id:'noticeBody',type:'textarea',full:true}], 'নোটিশ প্রকাশ করুন',async()=>{
      await db.collection('notices').add({title:value('noticeTitle'),body:value('noticeBody'),createdAt:firebase.firestore.FieldValue.serverTimestamp(),createdBy:currentUser.uid}); showMessage('নোটিশ প্রকাশ হয়েছে।','success'); noticesPage();
    });
    const snap=await db.collection('notices').orderBy('createdAt','desc').get(); renderDocs(snap,d=>`${d.title||''}: ${d.body||''}`);
    snap.forEach(doc=>{const b=make('button',{className:'submit danger'},'নোটিশ মুছুন');b.addEventListener('click',async()=>{if(confirm('নোটিশ মুছবে?')){await db.collection('notices').doc(doc.id).delete();noticesPage();}});main.append(b);});
  }
  async function coursesPage() {
    if(!requireRole('admin','teacher','student'))return; const canEdit=['admin','teacher'].includes(currentProfile.role); clear('📚 কোর্স ম্যাপিং','কোর্স ও শিক্ষকের তথ্য');
    if(canEdit) addForm([{label:'কোর্সের নাম',id:'courseName'},{label:'কোর্স কোড',id:'courseCode',required:false},{label:'শিক্ষকের নাম',id:'courseTeacher'},{label:'সেশন',id:'courseSession'}],'কোর্স যোগ করুন',async()=>{
      await db.collection('courses').add({course:value('courseName'),code:value('courseCode'),teacher:value('courseTeacher'),session:value('courseSession'),createdAt:firebase.firestore.FieldValue.serverTimestamp()}); coursesPage();
    });
    const snap=await db.collection('courses').orderBy('course').get(); renderDocs(snap,d=>`${d.course||''} (${d.code||'কোড নেই'}) — শিক্ষক: ${d.teacher||'—'} — সেশন: ${d.session||'—'}`);
    if(canEdit) snap.forEach(doc=>{const b=make('button',{className:'submit danger'},'কোর্স মুছুন');b.addEventListener('click',async()=>{if(confirm('কোর্সটি মুছবে?')){await db.collection('courses').doc(doc.id).delete();coursesPage();}});main.append(b);});
  }
  async function reportPage() {
    if(!requireRole('admin','teacher'))return; clear('📊 হাজিরা রিপোর্ট','লাইভ রিপোর্ট ও Tracking — Firebase-এ সংরক্ষিত রেকর্ড');
    const f=make('form',{className:'form-grid'}); addField(f,'তারিখ (ঐচ্ছিক)','reportDate','date',{required:false}); addField(f,'রোল/নাম খুঁজুন','reportSearch','text',{required:false});
    const a=make('div',{className:'full'}); const b=make('button',{className:'submit',type:'submit'},'রিপোর্ট দেখুন');a.append(b);f.append(a);main.append(f);
    const results=make('div',{className:'data-list'});main.append(results);
    async function load(){results.replaceChildren();let q=db.collection('attendance');if(value('reportDate'))q=q.where('date','==',value('reportDate'));const snap=await q.get();let rows=[];snap.forEach(d=>rows.push({id:d.id,...d.data()}));const term=value('reportSearch').toLowerCase();if(term)rows=rows.filter(r=>String(r.roll||'').toLowerCase().includes(term)||String(r.studentName||'').toLowerCase().includes(term));rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));if(!rows.length){results.append(make('p',{},'কোনো হাজিরার তথ্য পাওয়া যায়নি।'));return;}rows.forEach(r=>{const row=make('div',{className:'data-row'});row.append(make('p',{},`${r.date||''} ${r.time||''} — ${r.studentName||'নাম নেই'} (রোল: ${r.roll||'—'}) — ${r.status||''} — ${r.sessionTitle||''}`));results.append(row);});const dl=make('button',{className:'submit secondary'},'CSV রিপোর্ট ডাউনলোড');dl.addEventListener('click',()=>downloadFile('amc-attendance-report.csv','\uFEFF'+toCSV(rows,['date','time','studentName','roll','sessionTitle','status']),'text/csv;charset=utf-8'));results.append(dl);}
    f.addEventListener('submit',e=>{e.preventDefault();load().catch(err=>showMessage(errorText(err),'error'));}); await load();
  }
  async function manualPage() {
    if(!requireRole('admin','teacher'))return; clear('✍️ ম্যানুয়াল হাজিরা','শিক্ষার্থীর Firebase UID, তারিখ ও সেশন লিখে হাজিরা যোগ করো।');
    addForm([{label:'শিক্ষার্থীর Firebase UID',id:'manualUid',full:true},{label:'শিক্ষার্থীর নাম',id:'manualName'},{label:'রোল',id:'manualRoll'},{label:'তারিখ',id:'manualDate',type:'date'},{label:'সেশনের নাম',id:'manualSession',required:false}], 'হাজিরা যোগ করুন',async()=>{
      const uid=value('manualUid'); const date=value('manualDate')||localDate(); const id=`${uid}_${date}_manual_${Date.now()}`;
      await db.collection('attendance').doc(id).set({studentUid:uid,studentName:value('manualName'),roll:value('manualRoll'),date,time:new Date().toLocaleTimeString('en-GB'),sessionTitle:value('manualSession')||'ম্যানুয়াল এন্ট্রি',status:'উপস্থিত (ম্যানুয়াল)',createdAt:firebase.firestore.FieldValue.serverTimestamp(),createdBy:currentUser.uid}); showMessage('ম্যানুয়াল হাজিরা যোগ হয়েছে।','success');
    });
  }
  async function marksPage() {
    if(!requireRole('admin','teacher'))return; clear('🧮 নম্বর এন্ট্রি','নম্বর যোগ ও তালিকা');
    addForm([{label:'শিক্ষার্থীর Firebase UID',id:'markUid',full:true},{label:'শিক্ষার্থীর রোল',id:'markRoll'},{label:'বিষয়/কোর্স',id:'markSubject'},{label:'প্রাপ্ত নম্বর',id:'markValue',type:'number',attrs:{min:'0',max:'100',step:'0.01'}},{label:'পূর্ণমান',id:'markTotal',type:'number',attrs:{min:'1',max:'1000'},required:false}], 'নম্বর সংরক্ষণ',async()=>{
      const mark=Number(value('markValue')); if(!Number.isFinite(mark)||mark<0)throw new Error('সঠিক নম্বর লিখুন।');
      await db.collection('marks').add({studentUid:value('markUid'),roll:value('markRoll'),subject:value('markSubject'),mark,total:Number(value('markTotal'))||100,createdAt:firebase.firestore.FieldValue.serverTimestamp(),createdBy:currentUser.uid}); showMessage('নম্বর সংরক্ষণ হয়েছে।','success'); marksPage();
    });
    const snap=await db.collection('marks').orderBy('createdAt','desc').get();renderDocs(snap,d=>`রোল ${d.roll||'—'} — ${d.subject||''}: ${d.mark}/${d.total||100}`);
  }
  async function myAttendance() {
    if(!requireRole('student'))return; clear('📊 আমার হাজিরা',`${currentProfile.name||''} — রোল ${currentProfile.roll||'—'}`);
    const snap=await db.collection('attendance').where('studentUid','==',currentUser.uid).get();let rows=[];snap.forEach(d=>rows.push(d.data()));rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));renderDocs({empty:!rows.length,forEach:fn=>rows.forEach((r,i)=>fn({data:()=>r,id:String(i)}))},r=>`${r.date||''} — ${r.sessionTitle||''} — ${r.status||''}`);main.append(make('p',{},`মোট হাজিরা রেকর্ড: ${rows.length}`));
  }
  async function myMarks() {
    if(!requireRole('student'))return; clear('🧮 আমার নম্বর');const snap=await db.collection('marks').where('studentUid','==',currentUser.uid).get();renderDocs(snap,d=>`${d.subject||''}: ${d.mark}/${d.total||100}`);
  }
  async function myCourses() { if(!requireRole('student'))return; await coursesPage(); }
  async function backupPage() {
    if(!requireRole('admin'))return; clear('💾 Backup / Restore','Firestore ডেটা JSON ফাইলে ডাউনলোড বা পুনরুদ্ধার করুন।');
    addButton(main,'ব্যাকআপ ডাউনলোড',async()=>{
      const data={}; for(const name of COLLECTIONS){const snap=await db.collection(name).get();data[name]=snap.docs.map(d=>({id:d.id,...d.data()}));}
      downloadFile('amc-attendance-backup.json',JSON.stringify(data,null,2),'application/json');
    });
    addForm([{label:'JSON ব্যাকআপ ফাইল নির্বাচন',id:'backupFile',type:'file',full:true,attrs:{accept:'.json,application/json'}}],'ব্যাকআপ পুনরুদ্ধার',async f=>{
      const file=f.querySelector('#backupFile').files[0];if(!file)throw new Error('আগে JSON ফাইল নির্বাচন করো।');const data=JSON.parse(await file.text());if(!confirm('ব্যাকআপের তথ্য Firestore-এ যোগ হবে। একই ID থাকলে পুরোনো তথ্য বদলাতে পারে। চালিয়ে যাবে?'))return;
      for(const name of COLLECTIONS){if(!Array.isArray(data[name]))continue;for(let i=0;i<data[name].length;i+=400){const batch=db.batch();data[name].slice(i,i+400).forEach(item=>{if(!item.id)return;const copy={...item};delete copy.id;batch.set(db.collection(name).doc(item.id),copy,{merge:true});});await batch.commit();}}
      showMessage('ব্যাকআপ পুনরুদ্ধার সম্পন্ন হয়েছে।','success');
    });
  }
  function toCSV(rows,keys){return [keys.join(','),...rows.map(r=>keys.map(k=>'"'+String(r[k]??'').replace(/"/g,'""')+'"').join(','))].join('\n');}
  function downloadFile(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=make('a',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
})();
