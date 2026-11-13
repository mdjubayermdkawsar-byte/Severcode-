const GITHUB_USERNAME = "mdjubayermdkawsar-byte";
const GITHUB_REPO = "Severcode-";
const GITHUB_TOKEN = "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";

const headers = {
  'Authorization': `token ${GITHUB_TOKEN}`,
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'Vercel-Vault-Admin'
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const dbRes = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/vault_index.json?_t=${Date.now()}`, { headers });
      if (dbRes.status === 404) return res.status(200).json({ projects: [] });
      
      const data = await dbRes.json();
      if (!data.content) return res.status(200).json({ projects: [] });
      
      const content = Buffer.from(data.content.replace(/\s/g, ''), 'base64').toString('utf8');
      return res.status(200).json(JSON.parse(content));
    } catch (e) {
      return res.status(200).json({ projects: [] });
    }
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(err) {}
      }

      const { action, projectName, fileName, fileContent } = body || {};

      if (!action || !projectName) {
        return res.status(400).json({ error: "Missing action or projectName" });
      }

      // ১. গিটহাব থেকে বর্তমান ইন্ডেক্স ফাইল আনা
      let dbData = { projects: [] };
      let sha = null;
      const getIndex = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/vault_index.json?_t=${Date.now()}`, { headers });
      
      if (getIndex.status === 401) {
        return res.status(401).json({ error: "GitHub Token Invalid! অনুগ্রহ করে টোকেন চেক করুন।" });
      }
      
      if (getIndex.ok) {
        const d = await getIndex.json();
        sha = d.sha;
        dbData = JSON.parse(Buffer.from(d.content.replace(/\s/g, ''), 'base64').toString('utf8'));
      }

      // ২. নতুন প্রজেক্ট তৈরি
      if (action === 'create_project') {
        const cleanName = projectName.trim();
        if (!dbData.projects.find(p => p.name.toLowerCase() === cleanName.toLowerCase())) {
          dbData.projects.push({ name: cleanName, files: [] });
        }
      }

      // ৩. ফাইল তৈরি বা কোড সেভ
      if (action === 'save_file') {
        const cleanProj = projectName.trim();
        const cleanFile = fileName.trim();
        const filePath = `vault/${cleanProj}/${cleanFile}`;
        
        let fileSha = null;
        const checkF = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}?_t=${Date.now()}`, { headers });
        if (checkF.ok) {
          const fd = await checkF.json();
          fileSha = fd.sha;
        }

        const saveRes = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Update ${filePath}`,
            content: Buffer.from(fileContent || '', 'utf8').toString('base64'),
            sha: fileSha || undefined
          })
        });

        if (!saveRes.ok) {
          const err = await saveRes.json().catch(() => ({}));
          return res.status(500).json({ error: "ফাইল সেভ ব্যর্থ: " + (err.message || saveRes.statusText) });
        }

        let proj = dbData.projects.find(p => p.name.toLowerCase() === cleanProj.toLowerCase());
        if (!proj) {
          proj = { name: cleanProj, files: [] };
          dbData.projects.push(proj);
        }
        if (!proj.files.includes(cleanFile)) {
          proj.files.push(cleanFile);
        }
      }

      // ৪. ইন্ডেক্স ফাইলটি গিটহাবে আপডেট করা
      const updateRes = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/vault_index.json`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: "Sync vault index",
          content: Buffer.from(JSON.stringify(dbData, null, 2), 'utf8').toString('base64'),
          sha: sha || undefined
        })
      });

      if (!updateRes.ok) {
        const err = await updateRes.json().catch(() => ({}));
        return res.status(500).json({ error: "ইন্ডেক্স আপডেট ব্যর্থ: " + (err.message || updateRes.statusText) });
      }

      return res.status(200).json({ success: true, projects: dbData.projects });
    } catch (err) {
      return res.status(500).json({ error: "সার্ভার এরর: " + err.message });
    }
  }
};
