// api/college.js — Vercel Serverless Function (কোনো বাইরের প্যাকেজ লাগে না)
// কলেজের অর্থনীতি বিভাগের পেজ থেকে নোটিশ, শিক্ষক (ছবি/ফোন/BCS) ও আজকের রুটিন পড়ে JSON দেয়।
// পরীক্ষা: https://<আপনার-সাইট>.vercel.app/api/college?debug=1

const BASE = 'https://www.anandamohangovtcollege.edu.bd';
const DEPT = BASE + '/home/department?department=MTU=';
const UA = 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'text/html,*/*', 'accept-language': 'bn,en;q=0.8' },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&nbsp;': ' ' };
const dec = (s) =>
  String(s)
    .replace(/&(amp|lt|gt|quot|nbsp);/g, (m) => ENT[m])
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n));
const text = (h) =>
  dec(String(h).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
