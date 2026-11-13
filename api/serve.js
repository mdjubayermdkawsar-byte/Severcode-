module.exports = async (req, res) => {
  const { project, file, token } = req.query;

  // সিকিউরিটি চেক: আপনি চাইলে এখানে একটি সিক্রেট হ্যান্ডশেক কি রাখতে পারেন
  if (!project || !file) {
    return res.status(400).send("Bad Request: Missing parameters");
  }

  const GITHUB_USERNAME = process.env.GH_USERNAME;
  const GITHUB_REPO = process.env.GH_REPO;
  const GITHUB_TOKEN = process.env.GH_TOKEN;

  try {
    const filePath = `vault/${project}/${file}`;
    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}?ref=main`;

    const ghRes = await fetch(url, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Vercel-Vault-Engine'
      }
    });

    if (!ghRes.ok) {
      return res.status(404).send("File Not Found");
    }

    const data = await ghRes.json();
    const rawBuffer = Buffer.from(data.content, 'base64');

    // অ্যান্ড্রয়েডে সরাসরি বাইনারি হিসেবে ডেলিভারি
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(200).send(rawBuffer);

  } catch (error) {
    return res.status(500).send("Internal Server Error");
  }
};
