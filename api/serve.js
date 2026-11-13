const GITHUB_USERNAME = "mdjubayermdkawsar-byte";
const GITHUB_REPO = "Severcode-";
const GITHUB_TOKEN = "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";

module.exports = async (req, res) => {
  const { project, file } = req.query;

  if (!project || !file) {
    return res.status(400).send("Bad Request: Missing project or file parameter");
  }

  try {
    const filePath = `vault/${project}/${file}`;
    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}?ref=main&_t=${Date.now()}`;

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
    const cleanB64 = data.content.replace(/\s/g, '');
    const rawBuffer = Buffer.from(cleanB64, 'base64');

    // অ্যান্ড্রয়েডে সরাসরি বাইনারি হিসেবে ডেলিভারি
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(200).send(rawBuffer);

  } catch (error) {
    return res.status(500).send("Internal Server Error: " + error.message);
  }
};
