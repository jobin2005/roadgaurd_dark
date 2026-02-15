export function showAlert(message, type = 'error', duration = 5000) {
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.style.cssText = `
    position: fixed;
    top: 1rem;
    right: 1rem;
    max-width: 400px;
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
  `;
  alert.textContent = message;

  document.body.appendChild(alert);

  if (duration > 0) {
    setTimeout(() => alert.remove(), duration);
  }

  return alert;
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);
