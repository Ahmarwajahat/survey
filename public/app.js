document.addEventListener('DOMContentLoaded', () => {
  const surveyForm = document.getElementById('survey-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const evaluationOptionInput = document.getElementById('evaluation-option');
  const validationMsg = document.getElementById('validation-msg');
  
  const formCard = document.getElementById('form-card');
  const terminalCard = document.getElementById('terminal-card');
  const resultCard = document.getElementById('result-card');
  
  const logsContainer = document.getElementById('logs-container');
  const terminalLoader = document.getElementById('terminal-loader');
  const resetBtn = document.getElementById('reset-btn');
  const resultTitle = document.getElementById('result-title');
  const resultMsg = document.getElementById('result-msg');

  let eventSource = null;

  // Add line to terminal logs
  function appendLog(message, type = 'normal') {
    const line = document.createElement('div');
    line.className = 'log-line';
    
    // Automatically detect status colors if type is default
    if (type === 'normal') {
      if (message.startsWith('✅') || message.startsWith('🎉') || message.startsWith('🏁')) {
        line.classList.add('success-msg');
      } else if (message.startsWith('❌') || message.startsWith('💥') || message.startsWith('⚠️')) {
        line.classList.add('error-msg');
      }
    } else {
      line.classList.add(`${type}-msg`);
    }

    line.textContent = message;
    logsContainer.appendChild(line);
    logsContainer.scrollTop = logsContainer.scrollHeight;
  }

  // Handle Form Submit
  surveyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const optionIndex = evaluationOptionInput.value;

    // Reset validation
    validationMsg.textContent = '';

    // Validate registration number (numeric check)
    const isNumeric = /^\d+$/.test(username);
    if (!isNumeric) {
      validationMsg.textContent = '❌ Registration Number must contain only numeric digits.';
      return;
    }

    // Switch view to terminal
    formCard.classList.add('hidden');
    terminalCard.classList.remove('hidden');
    logsContainer.innerHTML = '';
    terminalLoader.classList.remove('hidden');
    terminalLoader.querySelector('span').textContent = 'Running automation, please do not close this tab...';
    
    appendLog('📡 Connecting to automation server...', 'system');

    // Build EventSource SSE query
    const url = `/api/run-survey?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&optionIndex=${encodeURIComponent(optionIndex)}`;
    eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'log') {
          appendLog(data.message);
        } else if (data.type === 'complete') {
          appendLog('🏁 Process completed successfully!', 'success');
          eventSource.close();
          
          setTimeout(() => {
            // Show Success view
            terminalCard.classList.add('hidden');
            resultCard.classList.remove('hidden');
            resultTitle.textContent = 'Surveys Completed!';
            resultMsg.textContent = 'All your pending course and teacher evaluations have been submitted successfully.';
          }, 2500);
        } else if (data.type === 'error') {
          appendLog(`💥 Fatal Error: ${data.message}`, 'error');
          eventSource.close();
          terminalLoader.classList.add('hidden');
          
          // Show back button on terminal
          const backBtn = document.createElement('button');
          backBtn.className = 'btn-secondary';
          backBtn.textContent = 'Back to Login';
          backBtn.style.marginTop = '15px';
          backBtn.addEventListener('click', resetUI);
          logsContainer.appendChild(backBtn);
        }
      } catch (err) {
        appendLog(`❌ Parsing Error: ${err.message}`, 'error');
      }
    };

    eventSource.onerror = (err) => {
      appendLog('❌ Connection lost or server timeout. The task might still be running in the background. Please wait or check your portal dashboard.', 'error');
      eventSource.close();
      terminalLoader.classList.add('hidden');
      
      const backBtn = document.createElement('button');
      backBtn.className = 'btn-secondary';
      backBtn.textContent = 'Back to Login';
      backBtn.style.marginTop = '15px';
      backBtn.addEventListener('click', resetUI);
      logsContainer.appendChild(backBtn);
    };
  });

  // Reset UI State
  function resetUI() {
    if (eventSource) {
      eventSource.close();
    }
    usernameInput.value = '';
    passwordInput.value = '';
    validationMsg.textContent = '';
    
    formCard.classList.remove('hidden');
    terminalCard.classList.add('hidden');
    resultCard.classList.add('hidden');
  }

  resetBtn.addEventListener('click', resetUI);
});
