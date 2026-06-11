import streamlit as st
import asyncio
import subprocess
import sys
import os

# Set page config
st.set_page_config(
    page_title="Ibadat Survey Automator",
    page_icon="📝",
    layout="centered"
)

# Background install Playwright browsers if they are not installed
@st.cache_resource
def setup_playwright():
    with st.spinner("Setting up automation engine (this may take a minute on first load)..."):
        try:
            # Install chromium browser
            subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
            # Install system dependencies
            subprocess.run([sys.executable, "-m", "playwright", "install-deps"], check=True)
            return True
        except Exception as e:
            st.error(f"Playwright setup error: {e}")
            return False

# Trigger setup
setup_ok = setup_playwright()

# Custom styles for premium look
st.markdown("""
<style>
    .main {
        background-color: #0b0f19;
        color: #f3f4f6;
    }
    div[data-testid="stForm"] {
        background: rgba(17, 25, 40, 0.65);
        backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        padding: 30px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    .stButton>button {
        background: linear-gradient(135deg, #06b6d4, #8b5cf6);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 12px;
        font-weight: 600;
        width: 100%;
        box-shadow: 0 8px 20px rgba(139, 92, 246, 0.25);
        transition: all 0.3s ease;
    }
    .stButton>button:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 28px rgba(139, 92, 246, 0.4);
        filter: brightness(1.05);
    }
</style>
""", unsafe_allow_html=True)

st.title("Ibadat Survey Automator 🚀")
st.write("Enter your student portal credentials to submit all pending course and teacher evaluations with 'Strongly Agree' options.")

# Form inputs
with st.form("login_form"):
    username = st.text_input("Registration Number", placeholder="e.g. 5111124001")
    password = st.text_input("Portal Password", type="password")
    submit_btn = st.form_submit_button("Start Automated Survey")

async def fill_surveys(username, password, status_placeholder, log_container):
    from playwright.async_api import async_playwright

    logs = []
    def add_log(msg):
        logs.append(msg)
        log_container.code("\n".join(logs))

    async with async_playwright() as p:
        add_log("🚀 Launching background automation engine...")
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            add_log("🔑 Connecting to Ibadat Student Portal...")
            # Try connecting with retry
            for attempt in range(1, 4):
                try:
                    await page.goto("https://erp.iiui.edu.pk/student/login", wait_until="commit", timeout=60000)
                    break
                except Exception as e:
                    if attempt == 3: raise e
                    add_log(f"⚠️ Connection slow, retrying connection (Attempt {attempt+1}/3)...")
                    await asyncio.sleep(3)

            add_log("✍️ Entering login details...")
            await page.fill("#email", username)
            await page.fill("#password", password)
            await page.click("input[type='submit']")

            await asyncio.sleep(5)
            if "/login" in page.url:
                raise Exception("Login failed. Please verify your Registration Number and Password.")

            add_log("✅ Login successful!")

            add_log("🌐 Loading survey dashboard...")
            await page.goto("https://erp.iiui.edu.pk/student/student-survey", wait_until="commit", timeout=60000)
            await asyncio.sleep(3)

            # Get links
            links = await page.evaluate("""() => {
                return Array.from(document.querySelectorAll('a'))
                    .map(a => ({ href: a.href, text: a.textContent.trim() }))
                    .filter(l => l.href.includes('student-survey/') && (l.href.includes('course-evaluation') || l.href.includes('teacher-evaluation')));
            }""")

            if not links:
                add_log("🎉 No pending surveys found! All surveys are already completed.")
                return True, "No pending surveys."

            add_log(f"📋 Found {len(links)} pending surveys.")

            for i, link in enumerate(links):
                add_log(f"🔄 Processing [{i+1}/{len(links)}]: {link['text']}...")
                await page.goto(link['href'], wait_until="commit", timeout=60000)
                await asyncio.sleep(3)

                # Check submit button
                is_submit_visible = await page.evaluate("""() => {
                    const btn = document.querySelector('button[type="submit"]');
                    return btn && btn.offsetParent !== null;
                }""")

                if not is_submit_visible:
                    add_log(f"⚠️ Already submitted. Skipping.")
                    continue

                # Fill radio groups
                radio_names = await page.evaluate("""() => {
                    const inputs = Array.from(document.querySelectorAll('input[type="radio"]'));
                    return Array.from(new Set(inputs.map(input => input.name).filter(Boolean)));
                }""")

                for name in radio_names:
                    radios = await page.query_selector_all(f"input[name='{name}']")
                    if radios:
                        await radios[0].click()

                # Fill text inputs
                text_inputs = await page.query_selector_all("input[type='text'], textarea")
                for text_input in text_inputs:
                    is_visible = await page.evaluate("(el) => el.offsetParent !== null", text_input)
                    if is_visible:
                        await text_input.fill("N/A")

                # Submit
                await page.click('button[type="submit"]')
                
                # Check redirect
                try:
                    await page.wait_for_url('**/student-survey', timeout=15000)
                    add_log(f"✅ Submitted successfully.")
                except:
                    if "student-survey" in page.url and "evaluation" not in page.url:
                        add_log(f"✅ Submitted successfully.")
                    else:
                        add_log(f"⚠️ Warning: Submit took longer than expected, moving on...")

                await asyncio.sleep(1)

            add_log("🏁 All surveys completed successfully!")
            return True, "Success"

        except Exception as e:
            add_log(f"💥 Error: {str(e)}")
            return False, str(e)
        finally:
            await browser.close()

# Form actions
if submit_btn:
    if not setup_ok:
        st.error("Automation engine not loaded properly.")
    elif not username or not password:
        st.warning("Please fill in both username and password.")
    elif not username.isdigit():
        st.error("Registration Number must be numeric only.")
    else:
        status_placeholder = st.empty()
        log_container = st.empty()
        
        with status_placeholder.status("Running automation process...", expanded=True) as status:
            success, msg = asyncio.run(fill_surveys(username, password, status_placeholder, log_container))
            if success:
                status.update(label="Surveys completed successfully!", state="complete", expanded=False)
                st.success("🎉 All pending surveys have been completed!")
            else:
                status.update(label=f"Failed: {msg}", state="error")
                st.error(f"Error: {msg}")
