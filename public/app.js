document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('dropZone');
  const imageInput = document.getElementById('imageInput');
  const dropZoneContent = document.getElementById('dropZoneContent');
  const previewContainer = document.getElementById('previewContainer');
  const imagePreview = document.getElementById('imagePreview');
  const removeImageBtn = document.getElementById('removeImageBtn');
  const chefForm = document.getElementById('chefForm');
  const submitBtn = document.getElementById('submitBtn');
  const loadingState = document.getElementById('loadingState');
  const resultSection = document.getElementById('resultSection');
  const recipeOutput = document.getElementById('recipeOutput');
  const modelBadge = document.getElementById('modelBadge');
  const ubicacionInput = document.getElementById('ubicacionTexto');
  const geoBtn = document.getElementById('geoBtn');

  let selectedFile = null;

  // Detección de Geolocalización del Navegador
  geoBtn.addEventListener('click', () => {
    if ('geolocation' in navigator) {
      geoBtn.textContent = '🔄 Obteniendo...';
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          ubicacionInput.value = `Lat: ${lat.toFixed(3)}, Lon: ${lon.toFixed(3)} (Coordenadas exactas)`;
          geoBtn.textContent = '✅ Ubicación detectada';
        },
        () => {
          alert('No pudimos obtener tu geolocalización automática. Escribe tu ciudad manualmente.');
          geoBtn.textContent = '🎯 Usar mi ubicación actual';
        }
      );
    } else {
      alert('Tu navegador no soporta geolocalización.');
    }
  });

  dropZone.addEventListener('click', () => imageInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-amber-500', 'bg-amber-500/5');
  });

  ['dragleave', 'dragend'].forEach(type => {
    dropZone.addEventListener(type, () => {
      dropZone.classList.remove('border-amber-500', 'bg-amber-500/5');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-amber-500', 'bg-amber-500/5');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });

  imageInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  });

  function handleFileSelect(file) {
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida.');
      return;
    }
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.src = e.target.result;
      dropZoneContent.classList.add('hidden');
      previewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  removeImageBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedFile = null;
    imageInput.value = '';
    imagePreview.src = '';
    previewContainer.classList.add('hidden');
    dropZoneContent.classList.remove('hidden');
  });

  chefForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const ubicacion = ubicacionInput.value.trim() || 'Internacional';
    const modoCocina = document.querySelector('input[name="modoCocina"]:checked').value;
    const preferenciaTexto = document.getElementById('preferenciaTexto').value.trim();
    const estiloComida = document.getElementById('estiloComida').value;
    const comensales = document.getElementById('comensales').value;
    const sorprendeme = document.getElementById('sorprendeme').checked;

    if (modoCocina === 'heladera' && !selectedFile && !preferenciaTexto && !sorprendeme) {
      alert('⚠️ Por favor adjunta una foto o escribe alguna preferencia.');
      return;
    }

    resultSection.classList.add('hidden');
    loadingState.classList.remove('hidden');
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-50', 'cursor-not-allowed');

    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append('imagen', selectedFile);
      }
      formData.append('ubicacion', ubicacion);
      formData.append('modoCocina', modoCocina);
      formData.append('preferenciaTexto', preferenciaTexto);
      formData.append('estiloComida', estiloComida);
      formData.append('comensales', comensales);
      formData.append('sorprendeme', sorprendeme);

      const response = await fetch('/api/chef/analizar-imagen', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar la solicitud.');
      }

      modelBadge.textContent = `Geo: ${ubicacion.substring(0, 15)}...`;
      recipeOutput.textContent = data.recetaSugerida;
      resultSection.classList.remove('hidden');

    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      loadingState.classList.add('hidden');
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  });
});