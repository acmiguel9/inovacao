// WhiteSync — main.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─── RENDERER ────────────────────────────────────────────────
const canvas = document.getElementById('ws-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;

// ─── SCENE & CAMERA ──────────────────────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0.3, 7);
camera.lookAt(0, 0, 0);

// ─── LIGHTS ──────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.7));

const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
keyLight.position.set(4, 6, 5);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x4488ff, 0.9);
fillLight.position.set(-5, -2, -4);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0x00C9B1, 0.6);
rimLight.position.set(0, 4, -6);
scene.add(rimLight);

// ─── LOAD MODEL ──────────────────────────────────────────────
// pivot holds the centered model; we animate pivot's position/rotation
const pivot = new THREE.Group();
scene.add(pivot);

let modelReady = false;
let baseScale = 1;

const loadingOverlay = document.getElementById('loading-overlay');
const loadingBarFill  = document.getElementById('loading-bar-fill');
const loadingLabel    = document.getElementById('loading-label');

const loader = new GLTFLoader();
loader.load(
  'Prototipo.glb',
  (gltf) => {
    const model = gltf.scene;

    // 1. Compute bounding box BEFORE any transform
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // 2. Move model so its center is at group origin
    model.position.sub(center);

    // 3. Scale group so the longest dimension = 3.8 world units
    baseScale = 3.8 / maxDim;
    tScale = baseScale;
    cScale = baseScale;
    pivot.scale.setScalar(baseScale);

    model.updateMatrixWorld(true);

    // 4. Improve materials and prepare fading
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.envMapIntensity = 1.0;
        child.castShadow = true;
        child.material.transparent = true;
        child.material.needsUpdate = true;

        const meshCenter = new THREE.Vector3();
        if (child.geometry.boundingBox === null) {
          child.geometry.computeBoundingBox();
        }
        child.geometry.boundingBox.getCenter(meshCenter);
        meshCenter.applyMatrix4(child.matrixWorld);

        // The board is centered around y=0. The camera is at the top.
        child.userData.isCamera = (meshCenter.y > size.y * 0.35);
      }
    });

    // Slight downward offset to visually center the model
    model.position.y -= 0.0; // fine-tune if needed
    pivot.add(model);

    // Set initial position (hero: right side, visible through gradient)
    pivot.position.x = 1.6;
    pivot.position.y = -0.3;
    cPosX = 1.6; cPosY = -0.3;
    tPosX = 1.6; tPosY = -0.3;
    modelReady = true;

    loadingOverlay.style.opacity = '0';
    setTimeout(() => { loadingOverlay.style.display = 'none'; }, 700);
  },
  (progress) => {
    if (progress.total > 0) {
      const pct = Math.round((progress.loaded / progress.total) * 100);
      if (loadingBarFill) loadingBarFill.style.width = pct + '%';
      if (loadingLabel)   loadingLabel.textContent   = pct + '%';
    }
  },
  (err) => {
    console.error('GLB load error:', err);
    if (loadingOverlay) loadingOverlay.style.display = 'none';
  }
);

// ─── SCROLL STATE ────────────────────────────────────────────
const heroEl      = document.getElementById('hero');
const showcaseEl  = document.getElementById('showcase-outer');
const panels      = document.querySelectorAll('.showcase-panel');

// Targets (what we lerp toward) - start at hero defaults
let tRotY = -0.5,  cRotY = -0.5;
let tPosX = 1.6, cPosX = 1.6;
let tPosY = -0.3, cPosY = -0.3;
let tScale = 1.0,  cScale = 1.0;
let tOpacity = 1.0, cOpacity = 1.0;
let autoRotating = true;

function lerp(a, b, t) { return a + (b - a) * t; }

let lastPanel = -1;
function showPanel(idx) {
  if (idx === lastPanel) return;
  lastPanel = idx;
  panels.forEach((p, i) => p.classList.toggle('visible', i === idx));
}

window.addEventListener('scroll', () => {
  const sy     = window.scrollY;
  const heroH  = heroEl.offsetHeight;
  const sTop   = showcaseEl.offsetTop;
  const sH     = showcaseEl.offsetHeight;
  const sEnd   = sTop + sH - window.innerHeight;

  if (sy < heroH) {
    // Hero: static rotation, positioned further right
    autoRotating = true;
    tPosX = 1.6; tPosY = -0.3;
    tScale = baseScale;
    tOpacity = 1.0;
    panels.forEach(p => p.classList.remove('visible'));
    lastPanel = -1;
  } else if (sy >= sTop && sy < sEnd) {
    // Showcase: scroll controls rotation, model centered
    autoRotating = false;
    const progress = Math.max(0, Math.min(1, (sy - sTop) / (sEnd - sTop)));
    
    // Default base showcase values (full board)
    const baseRotY = -0.4 + (progress * 0.8);
    let zoomProgress = 0;

    // Zoom only during Step 2 (roughly progress between 0.15 and 0.85 to be smooth)
    if (progress > 0.15 && progress < 0.85) {
      zoomProgress = Math.sin(((progress - 0.15) / 0.7) * Math.PI);
      zoomProgress = zoomProgress * zoomProgress; // ease in-out
    }

    tRotY = lerp(baseRotY, -1.7, zoomProgress); // rotate to side when zoomed
    tPosX = 0; 
    tPosY = lerp(-0.3, -2.1, zoomProgress); // move down to center camera
    tScale = lerp(baseScale, baseScale * 3.0, zoomProgress); // zoom in
    tOpacity = lerp(1.0, 0.15, zoomProgress); // fade out board
    
    showPanel(Math.min(Math.floor(progress * panels.length), panels.length - 1));
  } else {
    // Below showcase
    autoRotating = true;
    tPosX = 0; tPosY = -0.3;
    tScale = baseScale;
    tOpacity = 1.0;
    panels.forEach(p => p.classList.remove('visible'));
    lastPanel = -1;
  }
}, { passive: true });

// ─── ANIMATION LOOP ──────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  if (modelReady) {
    cPosX = lerp(cPosX, tPosX, 0.05);
    cPosY = lerp(cPosY, tPosY, 0.05);
    pivot.position.x = cPosX;
    pivot.position.y = cPosY;
    
    cScale = lerp(cScale, tScale, 0.05);
    pivot.scale.setScalar(cScale);

    cOpacity = lerp(cOpacity, tOpacity, 0.05);
    pivot.traverse((child) => {
      if (child.isMesh && child.material && !child.userData.isCamera) {
        child.material.opacity = cOpacity;
      }
    });

    if (autoRotating) {
      // Fixed rotation to the right, no oscillation, no float
      tRotY = -0.5;
      cRotY = lerp(cRotY, tRotY, 0.05);
      pivot.rotation.y = cRotY;
      pivot.position.y = cPosY;
    } else {
      cRotY = lerp(cRotY, tRotY, 0.06);
      pivot.rotation.y = cRotY;
    }
  }

  renderer.render(scene, camera);
}
animate();

// ─── RESIZE ──────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── NAVBAR SCROLL STATE ─────────────────────────────────────
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// ─── LANGUAGE SWITCHER ───────────────────────────────────────
const translations = {
  pt: {
    'nav.features': 'Funcionalidades', 'nav.how': 'Como Funciona',
    'nav.usecases': 'Casos de Uso', 'nav.pricing': 'Preço', 'nav.cta': 'Pedir Demo',
    'hero.eyebrow': 'Protótipo Disponível',
    'hero.title': 'O teu quadro,<br><span class="highlight">sempre contigo.</span>',
    'hero.sub': 'WhiteSync digitaliza o conteúdo do teu quadro branco em segundos — sem câmeras caras nem configurações complexas.',
    'hero.cta1': 'Pedir Demo', 'hero.cta2': 'Ver como funciona',
    'hero.stat1.value': '€600', 'hero.stat1.label': 'Preço de lançamento',
    'hero.stat2.value': '&lt;5s', 'hero.stat2.label': 'Para digitalizar',
    'hero.stat3.value': 'USB', 'hero.stat3.label': 'Alimentação Contínua',
    'sc.step': 'Passo',
    'sc.0.title': 'Deteção Inteligente',
    'sc.0.desc': 'O WhiteSync reconhece automaticamente os limites do quadro branco e calibra a captura com precisão.',
    'sc.1.title': 'Captura em Tempo Real',
    'sc.1.desc': 'O dispositivo processa o conteúdo do quadro em alta resolução, sem necessidade de ligação à internet.',
    'sc.2.title': 'Partilha Instantânea',
    'sc.2.desc': 'Exporta para PDF, envia por email ou guarda na nuvem — diretamente da aplicação WhiteSync.',
    'how.label': 'Como Funciona', 'how.title': 'Simples como 1, 2, 3',
    'how.sub': 'Sem instalações complicadas. O WhiteSync encaixa em qualquer quadro branco e começa a trabalhar de imediato.',
    'how.s1.title': 'Fixar', 'how.s1.desc': 'Coloca o WhiteSync no topo do quadro, no meio. Instalação simples, basta ligar o cabo USB.',
    'how.s2.title': 'Capturar', 'how.s2.desc': 'O dispositivo digitaliza o conteúdo do quadro em tempo real, de forma automática.',
    'how.s3.title': 'Partilhar', 'how.s3.desc': 'Exporta para PDF ou partilha diretamente pela app. Simples assim.',
    'feat.label': 'Funcionalidades', 'feat.title': 'Tudo o que precisas',
    'feat.sub': 'Desenvolvido para o ambiente profissional e educativo moderno.',
    'feat.1.title': 'Digitalização Instantânea', 'feat.1.desc': 'Captura o conteúdo do quadro em menos de 5 segundos, com alta resolução.',
    'feat.2.title': 'Exportação PDF & Nuvem', 'feat.2.desc': 'Guarda em PDF ou sincroniza com Google Drive, OneDrive e mais.',
    'feat.3.title': 'Processamento Local', 'feat.3.desc': 'A imagem é processada localmente e só é sincronizada com a nuvem através da aplicação quando quiseres partilhar.',
    'feat.4.title': 'Qualquer Quadro Branco', 'feat.4.desc': 'Compatível com qualquer quadro branco padrão — sem adaptadores.',
    'feat.5.title': 'Alimentação USB', 'feat.5.desc': 'Uso contínuo e ininterrupto. Liga diretamente por cabo USB, sem te preocupares com baterias.',
    'feat.6.title': 'Compacto & Portátil', 'feat.6.desc': 'Cabe na palma da mão. Leva-o de sala em sala sem esforço.',
    'uc.label': 'Casos de Uso', 'uc.title': 'Para quem é feito',
    'uc.sub': 'O WhiteSync adapta-se ao teu ambiente de trabalho.',
    'uc.tab1': 'Empresas', 'uc.tab2': 'Escolas', 'uc.tab3': 'Universidades',
    'uc.biz.h': 'Para Empresas e Reuniões',
    'uc.biz.1': 'Digitaliza notas de reuniões sem esforço',
    'uc.biz.2': 'Partilha o conteúdo com participantes remotos em segundos',
    'uc.biz.3': 'Integração com ferramentas de produtividade (Teams, Slack)',
    'uc.biz.4': 'Reduz o tempo gasto a tirar fotografias ao quadro',
    'uc.school.h': 'Para Escolas e Salas de Aula',
    'uc.school.1': 'Os alunos recebem o conteúdo da aula digitalmente',
    'uc.school.2': 'Professores poupam tempo na preparação de materiais',
    'uc.school.3': 'Ideal para ensino híbrido e online',
    'uc.school.4': 'Alternativa acessível ao SmartBoard',
    'uc.uni.h': 'Para Universidades',
    'uc.uni.1': 'Capture conteúdo de aulas magistrais automaticamente',
    'uc.uni.2': 'Repositório digital de conteúdo académico',
    'uc.uni.3': 'Suporte a investigação e colaboração entre docentes',
    'uc.uni.4': 'Fácil integração com sistemas LMS existentes',
    'cmp.label': 'Comparação', 'cmp.title': 'WhiteSync vs Concorrência',
    'cmp.sub': 'Funcionalidades profissionais a uma fração do preço.',
    'cmp.row1': 'Preço', 'cmp.row2': 'Instalação', 'cmp.row3': 'Exportação PDF',
    'cmp.row4': 'Processamento Local', 'cmp.row5': 'Portátil', 'cmp.row6': 'Sem subscrição',
    'cmp.ws.setup': 'Plug & Play', 'cmp.sc.setup': 'Complexa (Cat5e)',
    'cmp.sb.setup': 'Instalação profissional',
    'price.label': 'Preço', 'price.title': 'Lançamento de Protótipo',
    'price.sub': 'Preço especial para os primeiros clientes.',
    'price.badge': 'Pré-encomenda', 'price.name': 'WhiteSync Device',
    'price.period': 'pagamento único',
    'price.f1': 'Dispositivo WhiteSync', 'price.f2': 'Aplicação iOS & Android',
    'price.f3': '1 ano de atualizações gratuitas', 'price.f4': 'Suporte técnico incluído',
    'price.f5': 'Garantia de 2 anos', 'price.cta': 'Pedir Pré-encomenda',
    'contact.label': 'Contacto', 'contact.title': 'Fala connosco',
    'contact.sub': 'Tens dúvidas ou queres agendar uma demonstração? Entra em contacto.',
    'contact.f.name': 'Nome', 'contact.f.email': 'Email', 'contact.f.org': 'Organização',
    'contact.f.type': 'Tipo de organização', 'contact.f.type.p': 'Seleciona...',
    'contact.f.type.1': 'Empresa', 'contact.f.type.2': 'Escola',
    'contact.f.type.3': 'Universidade', 'contact.f.type.4': 'Outro',
    'contact.f.msg': 'Mensagem', 'contact.f.cta': 'Enviar Mensagem',
    'feedback.title': 'Deixa o teu feedback',
    'feedback.sub': 'Ajuda-nos a melhorar o WhiteSync preenchendo o formulário de avaliação do protótipo.',
    'footer.copy': '© 2026 WhiteSync. Todos os direitos reservados.',
  },
  en: {
    'nav.features': 'Features', 'nav.how': 'How It Works',
    'nav.usecases': 'Use Cases', 'nav.pricing': 'Pricing', 'nav.cta': 'Request Demo',
    'hero.eyebrow': 'Prototype Available',
    'hero.title': 'Your whiteboard,<br><span class="highlight">always with you.</span>',
    'hero.sub': 'WhiteSync digitizes your whiteboard content in seconds — no expensive cameras or complex setups required.',
    'hero.cta1': 'Request Demo', 'hero.cta2': 'See how it works',
    'hero.stat1.value': '€600', 'hero.stat1.label': 'Launch price',
    'hero.stat2.value': '&lt;5s', 'hero.stat2.label': 'To digitize',
    'hero.stat3.value': 'USB', 'hero.stat3.label': 'Continuous Power',
    'sc.step': 'Step',
    'sc.0.title': 'Smart Detection',
    'sc.0.desc': 'WhiteSync automatically recognizes the whiteboard boundaries and calibrates capture with precision.',
    'sc.1.title': 'Real-Time Capture',
    'sc.1.desc': 'The device processes whiteboard content in high resolution, no internet connection required.',
    'sc.2.title': 'Instant Sharing',
    'sc.2.desc': 'Export to PDF, send by email or save to the cloud — directly from the WhiteSync app.',
    'how.label': 'How It Works', 'how.title': 'Simple as 1, 2, 3',
    'how.sub': 'No complex installations. WhiteSync clips onto any whiteboard and starts working immediately.',
    'how.s1.title': 'Attach', 'how.s1.desc': 'Clip WhiteSync onto the top center of any whiteboard. Simple installation, just plug in the USB cable.',
    'how.s2.title': 'Capture', 'how.s2.desc': 'The device automatically scans and digitizes whiteboard content in real time.',
    'how.s3.title': 'Share', 'how.s3.desc': 'Export to PDF or share directly from the app. That simple.',
    'feat.label': 'Features', 'feat.title': 'Everything you need',
    'feat.sub': 'Built for modern professional and educational environments.',
    'feat.1.title': 'Instant Digitization', 'feat.1.desc': 'Capture whiteboard content in under 5 seconds, with high resolution.',
    'feat.2.title': 'PDF & Cloud Export', 'feat.2.desc': 'Save as PDF or sync with Google Drive, OneDrive and more.',
    'feat.3.title': 'Local Processing', 'feat.3.desc': 'Images are processed locally and only synced to the cloud via the app when you are ready to share.',
    'feat.4.title': 'Any Whiteboard', 'feat.4.desc': 'Compatible with any standard whiteboard — no adapters required.',
    'feat.5.title': 'USB Powered', 'feat.5.desc': 'Continuous and uninterrupted use. Plugs directly via USB cable, no battery worries.',
    'feat.6.title': 'Compact & Portable', 'feat.6.desc': 'Fits in the palm of your hand. Take it room to room effortlessly.',
    'uc.label': 'Use Cases', 'uc.title': 'Built for everyone',
    'uc.sub': 'WhiteSync adapts to your work environment.',
    'uc.tab1': 'Companies', 'uc.tab2': 'Schools', 'uc.tab3': 'Universities',
    'uc.biz.h': 'For Businesses & Meetings',
    'uc.biz.1': 'Effortlessly digitize meeting notes',
    'uc.biz.2': 'Share content with remote participants in seconds',
    'uc.biz.3': 'Integrates with productivity tools (Teams, Slack)',
    'uc.biz.4': 'Reduces time spent photographing whiteboards',
    'uc.school.h': 'For Schools & Classrooms',
    'uc.school.1': 'Students receive class content digitally',
    'uc.school.2': 'Teachers save time on material preparation',
    'uc.school.3': 'Ideal for hybrid and online learning',
    'uc.school.4': 'Affordable alternative to SmartBoard',
    'uc.uni.h': 'For Universities',
    'uc.uni.1': 'Automatically capture lecture content',
    'uc.uni.2': 'Digital repository of academic content',
    'uc.uni.3': 'Supports research and faculty collaboration',
    'uc.uni.4': 'Easy integration with existing LMS systems',
    'cmp.label': 'Comparison', 'cmp.title': 'WhiteSync vs Competition',
    'cmp.sub': 'Professional features at a fraction of the price.',
    'cmp.row1': 'Price', 'cmp.row2': 'Installation', 'cmp.row3': 'PDF Export',
    'cmp.row4': 'Local Processing', 'cmp.row5': 'Portable', 'cmp.row6': 'No subscription',
    'cmp.ws.setup': 'Plug & Play', 'cmp.sc.setup': 'Complex (Cat5e)',
    'cmp.sb.setup': 'Professional install',
    'price.label': 'Pricing', 'price.title': 'Prototype Launch',
    'price.sub': 'Special price for our first customers.',
    'price.badge': 'Pre-order', 'price.name': 'WhiteSync Device',
    'price.period': 'one-time payment',
    'price.f1': 'WhiteSync device', 'price.f2': 'iOS & Android app',
    'price.f3': '1 year of free updates', 'price.f4': 'Technical support included',
    'price.f5': '2-year warranty', 'price.cta': 'Pre-order Now',
    'contact.label': 'Contact', 'contact.title': 'Get in touch',
    'contact.sub': 'Have questions or want to schedule a demo? Reach out to us.',
    'contact.f.name': 'Name', 'contact.f.email': 'Email', 'contact.f.org': 'Organisation',
    'contact.f.type': 'Organisation type', 'contact.f.type.p': 'Select...',
    'contact.f.type.1': 'Company', 'contact.f.type.2': 'School',
    'contact.f.type.3': 'University', 'contact.f.type.4': 'Other',
    'contact.f.msg': 'Message', 'contact.f.cta': 'Send Message',
    'feedback.title': 'Leave your feedback',
    'feedback.sub': 'Help us improve WhiteSync by filling out our prototype evaluation form.',
    'footer.copy': '© 2026 WhiteSync. All rights reserved.',
  }
};

let currentLang = 'pt';
function applyLang(lang) {
  currentLang = lang;
  const t = translations[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) el.innerHTML = t[key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key] !== undefined) el.placeholder = t[key];
  });
  document.querySelectorAll('.lang-btn').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-lang') === lang));
  document.documentElement.lang = lang === 'pt' ? 'pt-PT' : 'en';
}
document.querySelectorAll('.lang-btn').forEach(btn =>
  btn.addEventListener('click', () => applyLang(btn.getAttribute('data-lang'))));
applyLang('pt');

// ─── TABS ────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-tab');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(target).classList.add('active');
  });
});

// ─── SCROLL REVEAL ───────────────────────────────────────────
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); revealObs.unobserve(e.target); }
  });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

// ─── NAV SMOOTH SCROLL ───────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
  });
});
