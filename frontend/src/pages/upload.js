import { createNavbar } from '../components/navbar.js';
import { supabase } from '../services/supabaseClient.js';
import { showAlert } from '../components/alert.js';

export function renderUploadPage(container) {
  const app = document.createElement('div');
  app.style.cssText = `
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  `;

  app.appendChild(createNavbar());

  const content = document.createElement('div');
  content.style.cssText = `
    flex: 1;
    padding: 2rem 1rem;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
  `;

  const header = document.createElement('h1');
  header.textContent = 'Report Pothole';
  header.style.marginBottom = '2rem';

  const form = document.createElement('form');
  form.id = 'uploadForm';
  form.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  `;

  const imageSection = createImageUploadSection();
  form.appendChild(imageSection);

  const detailsSection = createDetailsSection();
  form.appendChild(detailsSection);

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  `;

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Submit Report';
  submitBtn.style.cssText = `
    flex: 1;
    padding: 1rem;
    font-size: 1rem;
    font-weight: 600;
  `;

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'btn-secondary';
  cancelBtn.style.cssText = `
    flex: 1;
    padding: 1rem;
    font-size: 1rem;
    font-weight: 600;
  `;

  buttonContainer.appendChild(submitBtn);
  buttonContainer.appendChild(cancelBtn);

  form.appendChild(buttonContainer);

  content.appendChild(header);
  content.appendChild(form);
  app.appendChild(content);
  container.appendChild(app);

  form.addEventListener('submit', handleUpload);
  cancelBtn.addEventListener('click', () => window.history.back());
}

function createImageUploadSection() {
  const section = document.createElement('div');
  section.className = 'card';

  const title = document.createElement('h2');
  title.textContent = 'Upload Pothole Image';
  title.style.marginBottom = '1rem';

  const uploadArea = document.createElement('div');
  uploadArea.style.cssText = `
    border: 2px dashed var(--border);
    border-radius: 1rem;
    padding: 3rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    background: var(--bg-tertiary);
  `;

  uploadArea.onmouseenter = () => {
    uploadArea.style.borderColor = 'var(--accent-primary)';
    uploadArea.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
  };

  uploadArea.onmouseleave = () => {
    uploadArea.style.borderColor = 'var(--border)';
    uploadArea.style.backgroundColor = 'var(--bg-tertiary)';
  };

  const icon = document.createElement('div');
  icon.textContent = '📷';
  icon.style.fontSize = '3rem';
  icon.style.marginBottom = '1rem';

  const text = document.createElement('p');
  text.textContent = 'Drag and drop your image here, or click to select';
  text.style.color = 'var(--text-secondary)';
  text.style.marginBottom = '1rem';

  const input = document.createElement('input');
  input.type = 'file';
  input.id = 'imageInput';
  input.accept = 'image/*';
  input.style.display = 'none';

  const fileInfo = document.createElement('p');
  fileInfo.id = 'fileInfo';
  fileInfo.style.cssText = `
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-top: 0.5rem;
  `;

  const preview = document.createElement('img');
  preview.id = 'imagePreview';
  preview.style.cssText = `
    display: none;
    max-width: 100%;
    max-height: 400px;
    border-radius: 0.5rem;
    margin-top: 1rem;
  `;

  uploadArea.appendChild(icon);
  uploadArea.appendChild(text);
  uploadArea.appendChild(input);
  uploadArea.appendChild(fileInfo);
  uploadArea.appendChild(preview);

  uploadArea.addEventListener('click', () => input.click());

  input.addEventListener('change', (e) => handleImageSelect(e, uploadArea, preview, fileInfo));

  section.appendChild(title);
  section.appendChild(uploadArea);

  return section;
}

function createDetailsSection() {
  const section = document.createElement('div');
  section.className = 'card';

  const title = document.createElement('h2');
  title.textContent = 'Details';
  title.style.marginBottom = '1rem';

  // Description field
  const descField = document.createElement('div');
  descField.style.marginBottom = '1.5rem';

  const descLabel = document.createElement('label');
  descLabel.textContent = 'Description (Optional)';
  descLabel.style.cssText = `
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  `;

  const descInput = document.createElement('textarea');
  descInput.id = 'description';
  descInput.placeholder = 'Describe the pothole (location details, size, etc.)';
  descInput.style.cssText = `
    width: 100%;
    min-height: 100px;
    resize: vertical;
  `;

  descField.appendChild(descLabel);
  descField.appendChild(descInput);

  // Append to section
  section.appendChild(title);
  section.appendChild(descField);

  return section;
}


function handleImageSelect(event, uploadArea, preview, fileInfo) {
  const files = event.target.files;
  if (files && files.length > 0) {
    const file = files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      preview.src = e.target.result;
      preview.style.display = 'block';
      fileInfo.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
    };

    reader.readAsDataURL(file);
  }
}

async function handleUpload(e) {
  e.preventDefault();

  const imageInput = document.getElementById('imageInput');
  const description = document.getElementById('description').value;
  const severity = document.getElementById('severity').value;

  if (!imageInput.files || imageInput.files.length === 0) {
    showAlert('Please select an image', 'error');
    return;
  }

  try {
    const user = window.getCurrentUser();
    if (!user) {
      showAlert('Please log in to report potholes', 'error');
      return;
    }

    const userLocation = await getUserLocation();
    if (!userLocation) {
      showAlert('Please enable location access to report a pothole', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', imageInput.files[0]);

    const fileExt = imageInput.files[0].name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;

    const { data, error: uploadError } = await supabase.storage
      .from('pothole-images')
      .upload(`${user.id}/${fileName}`, imageInput.files[0]);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('pothole-images')
      .getPublicUrl(`${user.id}/${fileName}`);

    const { data: newPothole, error: insertError } = await supabase
      .from('potholes')
      .insert({
        user_id: user.id,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        severity,
        image_url: publicUrl,
        description,
        verified: false
      })
      .select();

    if (insertError) throw insertError;

    await supabase
      .from('user_profiles')
      .update({ contributions: supabase.rpc('increment_contributions', { user_id: user.id }) })
      .eq('id', user.id);

    showAlert('Pothole reported successfully! Thank you for contributing.', 'success');

    setTimeout(() => {
      document.getElementById('uploadForm').reset();
      document.getElementById('imagePreview').style.display = 'none';
    }, 1500);

  } catch (err) {
    showAlert(err.message || 'Failed to upload pothole report', 'error');
    console.error('Upload error:', err);
  }
}

function getUserLocation() {
  return new Promise((resolve) => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        () => resolve(null)
      );
    } else {
      resolve(null);
    }
  });
}
