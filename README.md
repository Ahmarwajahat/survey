# Playwright Survey Automation Script

This project contains a Node.js script using **Playwright** to automate the process of logging into a student portal and filling out a survey form multiple times in a loop.

---

## 🛠️ Prerequisites

Before running this script, ensure you have the following installed on your machine:
- **Node.js** (v16 or higher is recommended)
  - Verify installation by running: `node -v` and `npm -v`

---

## 📥 Installation

1. Navigate to the project folder (`/home/ahmar/Desktop/survay`):
   ```bash
   cd /home/ahmar/Desktop/survay
   ```
2. Install the dependencies (this will install the Playwright library and the required browser binaries):
   ```bash
   npm install
   ```

---

## ⚙️ Configuration

Open [index.js](file:///home/ahmar/Desktop/survay/index.js) in your editor and update the `CONFIG` block at the top of the file:

```javascript
const CONFIG = {
  // Portal & Credentials
  portalUrl: 'https://example.com/login', // Replace with your portal login URL
  username: 'your_username_here',        // Replace with your username
  password: 'your_password_here',        // Replace with your password

  // Selectors for Login
  usernameSelector: 'input[name="username"]', // Replace with your username field selector
  passwordSelector: 'input[name="password"]', // Replace with your password field selector
  loginButtonSelector: 'button[type="submit"]', // Replace with your login button selector

  // Survey Details
  surveyUrl: 'https://example.com/survey',      // Replace with your survey page URL
  submitButtonSelector: 'button.submit-btn',    // Replace with your survey submit button selector
  
  // Selection Logic
  targetOption: 'A', // Option choice to select: 'A', 'B', 'C', or 'D'

  // Number of times to fill and submit the survey
  loopCount: 5,

  // Browser Settings
  headless: false, // Set to true to run in the background (no window visible)
  slowMo: 150,     // Delay in milliseconds between actions
};
```

---

## 🔍 How to Find Selectors

If you do not know the selectors for your portal, follow these steps to find them:
1. Open your browser and navigate to the portal login page.
2. Right-click the **Username** field and select **Inspect**.
3. In the Elements panel, check the HTML tag attributes (e.g., `id`, `name`, `class`).
   - If it has an ID: use `#username-id`
   - If it has a name attribute: use `input[name="username"]`
   - If it has a unique class: use `.username-input-class`
4. Repeat this process for the **Password** field, the **Login** button, and the **Submit** button on the survey page.

---

## 🚀 Running the Script

To start the automation, run:
```bash
npm start
```

### Script Execution Flow
1. **Login Phase**: Launches a browser window (Chromium), navigates to the `portalUrl`, fills credentials, and submits the login form.
2. **Loop Phase**: Loops `loopCount` times:
   - Navigates directly to the `surveyUrl`.
   - Locates and selects the target option (`A`, `B`, `C`, or `D`) for all questions.
   - Clicks the survey submit button.
   - Waits for the page load or success confirmation.
3. **Closing**: Once the loops finish or a fatal error occurs, the browser closes.
