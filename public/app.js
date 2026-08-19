document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('dropZone');
  const imageInput = document.getElementById('imageInput');
  const photoGrid = document.getElementById('photoGrid');
  const chefForm = document.getElementById('chefForm');
  const submitBtn = document.getElementById('submitBtn');
  const loadingState = document.getElementById('loadingState');
  const resultSection = document.getElementById('resultSection');
  const recipeOutput = document.getElementById('recipeOutput');
  const modelBadge = document.getElementById('modelBadge');
  const voiceBtn = document.getElementById('voiceBtn');
  const voiceBtnText = document.getElementById('voiceBtnText');
  const preferenciaTexto = document.getElementById('preferenciaTexto');
  const ubicacionInput = document.getElementById('ubicacionTexto');
  const geoBtn = document.getElementById('geoBtn');

  let selectedFiles = [];

  // Dictado por Voz (Web Speech API)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;

    voiceBtn.addEventListener('click', () => {
      recognition.start();
      voiceBtnText.textContent = '🎙️ Escuchando... Habla ahora';
      voiceBtn.classList.add('bg-rose-500/30', 'text-rose-400');
    });

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      preferenciaTexto.value += (preferenciaTexto.value ? ' ' : '') + transcript;
      voiceBtnText.textContent = '🎙️ Dictar alimentos por voz';
      voiceBtn.classList.remove('bg-rose-500/30', 'text-rose-400');
    };

    recognition.onerror = () => {
      voiceBtnText.textContent = '🎙️ Dictar alimentos por voz';
      voiceBtn.classList.remove('bg-rose-500/30', 'text-rose-400');
    };
  } else {
    voiceBtn.style.display = 'none';
  }

  // Detección GPS
  geoBtn.addEventListener('click', () => {
    if ('geolocation' in navigator) {
      geoBtn.textContent = '🔄 Obteniendo...';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          ubicacionInput.value = `Lat: ${pos.coords.latitude.toFixed(3)}, Lon: ${pos.coords.longitude.toFixed(3)}`;
          geoBtn.textContent = '✅ Detectado';
        },
        () => {
          alert('No pudimos acceder al GPS. Escribe tu ciudad manualmente.');
          geoBtn.textContent = '🎯 Usar mi GPS';
        }
      );
    }
  });

  dropZone.addEventListener('click', () => imageInput.click());

  imageInput.addEventListener('change', (e) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files);
      filesArr.forEach(file => {
        if (selectedFiles.length < 4 && file.type.startsWith('image/')) {
          selectedFiles.push(file);
        }
      });
      renderPhotoPreviews();
    }
  });

  function renderPhotoPreviews() {
    const previews = photoGrid.querySelectorAll('.photo-preview');
    previews.forEach(p => p.remove());

    selectedFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const div = document.createElement('div');
        div.className = 'photo-preview relative rounded-xl overflow-hidden border border-slate-700 h-24 bg-slate-900';
        div.innerHTML = `
          <img src="${e.target.result}" class="w-full h-full object-cover">
          <button type="button" data-index="${index}" class="remove-img-btn absolute top-1 right-1 bg-rose-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold">×</button>
        `;
        photoGrid.insertBefore(div, dropZone);

        div.querySelector('.remove-img-btn').addEventListener('click', (ev) => {
          ev.stopPropagation();
          selectedFiles.splice(index, 1);
          renderPhotoPreviews();
        });
      };
      reader.readAsDataURL(file);
    });

    if (selectedFiles.length >= 4) {
      dropZone.classList.add('hidden');
    } else {
      dropZone.classList.remove('hidden');
    }
  }

  chefForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Recolectar condiciones de salud
    const saludCheckboxes = document.querySelectorAll('input[name="salud"]:checked');
    let condicionesSalud = Array.from(saludCheckboxes).map(cb => cb.value);
    const saludTextoExtra = document.getElementById('saludEspecialTexto').value.trim();
    if (saludTextoExtra) condicionesSalud.push(saludTextoExtra);

    // Recolectar preferencia de bebida
    const preferenciaBebida = document.querySelector('input[name="preferenciaBebida"]:checked').value;

    const formData = new FormData();
    selectedFiles.forEach(file => formData.append('imagenes', file));

    formData.append('ubicacion', ubicacionInput.value.trim() || 'Internacional');
    formData.append('condicionesSalud', JSON.stringify(condicionesSalud));
    formData.append('preferenciaBebida', preferenciaBebida);
    formData.append('modoCocina', document.querySelector('input[name="modoCocina"]:checked').value);
    formData.append('preferenciaTexto', preferenciaTexto.value.trim());
    formData.append('estiloComida', document.getElementById('estiloComida').value);
    formData.append('comensales', document.getElementById('comensales').value);
    formData.append('sorprendeme', document.getElementById('sorprendeme').checked);

    resultSection.classList.add('hidden');
    loadingState.classList.remove('hidden');
    submitBtn.disabled = true;

    try {
      const response = await fetch('/api/chef/analizar-imagen', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error procesando la solicitud');

      modelBadge.textContent = `Salud & Maridaje Activo`;
      recipeOutput.textContent = data.recetaSugerida;
      resultSection.classList.remove('hidden');
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      loadingState.classList.add('hidden');
      submitBtn.disabled = false;
    }
  });
});

// =============================================================
// CONTROLADOR UX INTELIGENTE DEL BANNER PWA (IACHEF)
// =============================================================
(function initPWABanner() {
  let deferredPrompt = null;

  const installBanner = document.getElementById('pwaInstallBanner');
  const btnInstall = document.getElementById('btnPwaInstall');
  const btnClose = document.getElementById('btnPwaClose');

  // Días de espera si el usuario presiona la 'X' para cerrar
  const DAYS_TO_WAIT_AFTER_DISMISS = 7;

  function shouldShowBanner() {
    // 1. Si la PWA ya está ejecutándose como aplicación instalada, NO mostrar
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (isStandalone) return false;

    // 2. Comprobar fecha de último descarte en el navegador
    const dismissedTimestamp = localStorage.getItem('pwaBannerDismissedTimestamp');
    if (dismissedTimestamp) {
      const now = new Date().getTime();
      const daysPassed = (now - parseInt(dismissedTimestamp, 10)) / (1000 * 60 * 60 * 24);

      // Si pasaron menos de 7 días, NO mostrar
      if (daysPassed < DAYS_TO_WAIT_AFTER_DISMISS) {
        return false;
      }
    }

    return true;
  }

  // Capturar evento de instalación nativo
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    if (shouldShowBanner()) {
      // Retrasar 2.5 segundos para no interrumpir la carga inicial del usuario
      setTimeout(() => {
        if (installBanner && deferredPrompt) {
          installBanner.classList.add('active');
          installBanner.setAttribute('aria-hidden', 'false');
        }
      }, 2500);
    }
  });

  // Evento: Botón 'Instalar'
  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (!deferredPrompt) return;

      if (installBanner) {
        installBanner.classList.remove('active');
      }

      deferredPrompt.prompt();

      const { outcome } = await deferredPrompt.userChoice;
      console.log(`Resultado de instalación PWA: ${outcome}`);

      deferredPrompt = null;
    });
  }

  // Evento: Botón 'X' (Cerrar)
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      if (installBanner) {
        installBanner.classList.remove('active');
      }

      // Guardar fecha/hora actual en memoria permanente del cliente
      localStorage.setItem('pwaBannerDismissedTimestamp', new Date().getTime().toString());
      console.log(`Banner PWA ocultado durante ${DAYS_TO_WAIT_AFTER_DISMISS} días.`);
    });
  }

  // Evento: Instalación completada con éxito
  window.addEventListener('appinstalled', () => {
    if (installBanner) {
      installBanner.classList.remove('active');
    }
    deferredPrompt = null;
    localStorage.setItem('pwaInstalled', 'true');
  });
})();