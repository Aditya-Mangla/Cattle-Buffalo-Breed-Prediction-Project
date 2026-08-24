/* ============================================================
   CATTLE & BUFFALO BREED RECOGNITION
   FRONTEND ↔ EXPRESS BACKEND INTEGRATION
   ============================================================ */

const CONFIG = {
  // If frontend and backend are served from the same server:
  // API_BASE_URL: ""

  // Use the backend origin when Express serves this page. Keep direct-file
  // and separate frontend-server usage pointed at the local API.
  API_BASE_URL:
    window.location.port === "5000" ||
    window.location.protocol === "file:"
      ? "http://localhost:5000"
      : "",

  AUTH_ENDPOINT: "/api/auth",
  BREED_ENDPOINT: "/api/breeds",
  PREDICTION_ENDPOINT: "/api/predictions",

  MAX_FILE_BYTES: 8 * 1024 * 1024,

  // Set false when backend is connected
  DEMO_FALLBACK: false
};


/* ============================================================
   DOM ELEMENTS
   ============================================================ */

const els = {
  fileInput: document.getElementById("fileInput"),
  dropzone: document.getElementById("dropzone"),
  heroUploadBtn: document.getElementById("heroUploadBtn"),

  resultEmpty: document.getElementById("resultEmpty"),
  resultLoading: document.getElementById("resultLoading"),
  resultFilled: document.getElementById("resultFilled"),
  resultError: document.getElementById("resultError"),
  resultErrorMsg: document.getElementById("resultErrorMsg"),
  retryBtn: document.getElementById("retryBtn"),

  resultImg: document.getElementById("resultImg"),
  matchBadge: document.getElementById("matchBadge"),
  resultBreedName: document.getElementById("resultBreedName"),
  resultLatin: document.getElementById("resultLatin"),
  resultConfidence: document.getElementById("resultConfidence"),
  detailTable: document.getElementById("detailTable"),

  traitList: document.getElementById("traitList"),
  traitListBottom: document.getElementById("traitListBottom"),
  suitedList: document.getElementById("suitedList"),

  historyList: document.getElementById("historyList"),
  viewAllHistory: document.getElementById("viewAllHistory"),

  breedsGrid: document.getElementById("breedsGrid"),
  breedSearch: document.getElementById("breedSearch"),
  filterPills: document.getElementById("filterPills"),
  viewAllBreedsBtn: document.getElementById("viewAllBreedsBtn"),

  viewFullInfoBtn: document.getElementById("viewFullInfoBtn"),
  viewSimilarBtn: document.getElementById("viewSimilarBtn"),

  modal: document.getElementById("breedModal"),
  modalContent: document.getElementById("modalContent"),
  modalClose: document.getElementById("modalClose"),

  toast: document.getElementById("toast"),

  learnMoreBtn: document.getElementById("learnMoreBtn")
};


/* ============================================================
   STATE
   ============================================================ */

let lastPrediction = null;
let activeFilter = "All";
let toastTimer = null;

let backendBreeds = [];
let historyData = [];


/* ============================================================
   AUTH ELEMENTS
   ============================================================ */

const authEls = {
  screen: document.getElementById("authScreen"),
  dashboard: document.getElementById("dashboard"),

  tabLogin: document.getElementById("tabLogin"),
  tabRegister: document.getElementById("tabRegister"),

  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),

  loginError: document.getElementById("loginError"),
  registerError: document.getElementById("registerError"),

  guestBtn: document.getElementById("guestBtn"),

  switchToRegister: document.getElementById("switchToRegister"),
  switchToLogin: document.getElementById("switchToLogin"),

  switchToRegisterText: document.getElementById(
    "switchToRegisterText"
  ),

  switchToLoginText: document.getElementById(
    "switchToLoginText"
  ),

  sidebarUser: document.getElementById("sidebarUser"),
  sidebarUserName: document.getElementById("sidebarUserName"),
  sidebarUserAvatar: document.getElementById("sidebarUserAvatar"),

  logoutBtn: document.getElementById("logoutBtn")
};


/* ============================================================
   API URL HELPER
   ============================================================ */

function apiUrl(endpoint) {
  return `${CONFIG.API_BASE_URL}${endpoint}`;
}

async function readJsonResponse(response) {
  const body = await response.text();

  if (!body.trim()) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    return {
      error: `Server returned an invalid response (${response.status}).`
    };
  }
}


/* ============================================================
   AUTH TOKEN
   ============================================================ */

function getToken() {
  return localStorage.getItem("authToken");
}


function setToken(token) {
  if (token) {
    localStorage.setItem("authToken", token);
  } else {
    localStorage.removeItem("authToken");
  }
}


/* ============================================================
   AUTH HEADERS
   ============================================================ */

function getAuthHeaders() {
  const token = getToken();

  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}


/* ============================================================
   CURRENT USER
   ============================================================ */

const SESSION_KEY = "breedRecognition.currentUser";


function getCurrentUser() {
  try {
    return JSON.parse(
      localStorage.getItem(SESSION_KEY)
    );
  } catch (error) {
    return null;
  }
}


function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify(user)
    );
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}


/* ============================================================
   TOAST
   ============================================================ */

function showToast(message) {
  if (!els.toast) return;

  els.toast.textContent = message;
  els.toast.classList.add("is-visible");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 2600);
}


/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */

function escapeHtml(str = "") {
  return String(str).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]
  );
}


function formatConfidence(value) {
  if (
    value === undefined ||
    value === null ||
    Number.isNaN(Number(value))
  ) {
    return "—";
  }

  const numericValue = Number(value);

  const percentage =
    numericValue <= 1
      ? numericValue * 100
      : numericValue;

  return `${percentage.toFixed(2)}%`;
}


function formatDate(date) {
  if (!date) return "—";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return "—";
  }

  return (
    d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }) +
    " · " +
    d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit"
    })
  );
}


function placeholderImg() {
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg"
           width="80"
           height="80">
        <rect width="80"
              height="80"
              fill="#e7f6ec"/>
      </svg>
    `)
  );
}


/* ============================================================
   RESULT STATE
   ============================================================ */

function setResultState(state) {
  if (els.resultEmpty) {
    els.resultEmpty.classList.toggle(
      "hidden",
      state !== "empty"
    );
  }

  if (els.resultLoading) {
    els.resultLoading.classList.toggle(
      "hidden",
      state !== "loading"
    );
  }

  if (els.resultFilled) {
    els.resultFilled.classList.toggle(
      "hidden",
      state !== "filled"
    );
  }

  if (els.resultError) {
    els.resultError.classList.toggle(
      "hidden",
      state !== "error"
    );
  }
}


/* ============================================================
   UPLOAD
   ============================================================ */

function wireUploadTriggers() {
  if (!els.fileInput) return;

  const openPicker = () => {
    els.fileInput.click();
  };

  if (els.heroUploadBtn) {
    els.heroUploadBtn.addEventListener(
      "click",
      openPicker
    );
  }

  if (els.dropzone) {
    els.dropzone.addEventListener(
      "click",
      openPicker
    );
  }

  els.fileInput.addEventListener(
    "change",
    (event) => {
      const file =
        event.target.files &&
        event.target.files[0];

      if (file) {
        handleFile(file);
      }

      els.fileInput.value = "";
    }
  );

  if (els.dropzone) {
    ["dragenter", "dragover"].forEach(
      (eventName) => {
        els.dropzone.addEventListener(
          eventName,
          (event) => {
            event.preventDefault();

            els.dropzone.classList.add(
              "is-dragover"
            );
          }
        );
      }
    );

    ["dragleave", "drop"].forEach(
      (eventName) => {
        els.dropzone.addEventListener(
          eventName,
          (event) => {
            event.preventDefault();

            els.dropzone.classList.remove(
              "is-dragover"
            );
          }
        );
      }
    );

    els.dropzone.addEventListener(
      "drop",
      (event) => {
        const file =
          event.dataTransfer.files &&
          event.dataTransfer.files[0];

        if (file) {
          handleFile(file);
        }
      }
    );

    els.dropzone.setAttribute(
      "tabindex",
      "0"
    );

    els.dropzone.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          els.dropzone.click();
        }
      }
    );
  }

  if (els.retryBtn) {
    els.retryBtn.addEventListener(
      "click",
      () => {
        setResultState("empty");
      }
    );
  }
}


function handleFile(file) {
  if (!file.type.startsWith("image/")) {
    showToast(
      "Please choose a JPG or PNG image."
    );

    return;
  }

  if (file.size > CONFIG.MAX_FILE_BYTES) {
    showToast(
      "Image is larger than 5MB."
    );

    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    setResultState("loading");

    predictBreed(
      file,
      reader.result
    );
  };

  reader.onerror = () => {
    showToast(
      "Unable to read the selected image."
    );
  };

  reader.readAsDataURL(file);
}


/* ============================================================
   PREDICT BREED
  POST /api/predictions
   ============================================================ */

async function predictBreed(
  file,
  imageDataUrl
) {
  const formData = new FormData();

  // MUST MATCH upload.single('image')
  formData.append("image", file);

  try {
    const response = await fetch(
      apiUrl(CONFIG.PREDICTION_ENDPOINT),
      {
        method: "POST",

        headers: getAuthHeaders(),

        body: formData
      }
    );

    if (!response.ok) {
      let errorMessage =
        `Prediction failed (${response.status})`;

      try {
        const errorData =
          await readJsonResponse(response);

        errorMessage =
          errorData.message ||
          errorData.error ||
          errorMessage;
      } catch (error) {
        // Ignore invalid JSON
      }

      throw new Error(errorMessage);
    }

    const data = await readJsonResponse(response);

    console.log(
      "Prediction API response:",
      data
    );

    const prediction =
      data.prediction ||
      data.result ||
      data.data ||
      data;

    renderPrediction(
      prediction,
      imageDataUrl,
      data
    );

    // Refresh history for logged-in user
    if (getToken()) {
      loadPredictionHistory();
    }

  } catch (error) {
    console.error(
      "Prediction API error:",
      error
    );

    if (CONFIG.DEMO_FALLBACK) {
      const mock =
        mockPrediction();

      renderPrediction(
        mock,
        imageDataUrl,
        mock
      );

      showToast(
        "Backend unavailable — demo result shown."
      );

      return;
    }

    if (els.resultErrorMsg) {
      els.resultErrorMsg.textContent =
        error.message ||
        "Unable to connect to prediction service.";
    }

    setResultState("error");
  }
}


/* ============================================================
   RENDER PREDICTION
   ============================================================ */

function renderPrediction(
  apiData,
  imageDataUrl,
  originalResponse = null
) {
  const merged =
    mergeWithReference(apiData);

  merged.imageDataUrl =
    imageDataUrl;

    merged.predictionId =
      apiData?._id ||
      apiData?.id ||
      apiData?.predictionId ||
    originalResponse?._id ||
    originalResponse?.id ||
      originalResponse?.predictionId ||
    null;

  lastPrediction = merged;

  if (els.resultImg) {
    els.resultImg.src =
      imageDataUrl ||
      placeholderImg();
  }

  if (els.resultBreedName) {
    els.resultBreedName.textContent =
      merged.breed;
  }

  if (els.resultLatin) {
    els.resultLatin.textContent =
      merged.scientific
        ? `(${merged.scientific})`
        : "";
  }

  if (els.resultConfidence) {
    els.resultConfidence.textContent =
      formatConfidence(
        merged.confidence
      );
  }

  const confidence =
    Number(merged.confidence);

  const percentage =
    confidence <= 1
      ? confidence * 100
      : confidence;

  if (els.matchBadge) {
    els.matchBadge.textContent =
      percentage >= 60
        ? "Match Found"
        : "Low Confidence";

    els.matchBadge.classList.toggle(
      "is-low",
      percentage < 60
    );
  }

  if (els.detailTable) {
    els.detailTable.innerHTML = [
      ["Origin", merged.origin],
      ["Breed Type", merged.type],
      ["Body Size", merged.bodySize],
      ["Purpose", merged.purpose],
      [
        "Special Features",
        merged.specialFeatures
      ]
    ]
      .map(
        ([key, value]) =>
          `<tr>
            <td>${escapeHtml(key)}</td>
            <td>${escapeHtml(String(value ?? "—"))}</td>
          </tr>`
      )
      .join("");
  }

  renderTraits(
    merged.characteristics
  );

  renderSuitedFor(
    merged.suitedFor
  );

  setResultState("filled");
}


/* ============================================================
   MERGE API RESPONSE WITH LOCAL BREED DATA
   ============================================================ */

function mergeWithReference(
  apiData = {}
) {
  const breedName =
    apiData.breed ||
    apiData.predictedBreed ||
    apiData.label ||
    apiData.predicted_breed ||
    apiData.class_name ||
    "";

  const ref =
    findBreedByName(breedName) ||
    {};

  return {
    breed:
      breedName ||
      ref.name ||
      "Unknown breed",

    type:
      apiData.type ||
      apiData.animal_type ||
      ref.type ||
      "",

    confidence:
      apiData.confidence ??
      apiData.score ??
      apiData.probability ??
      0,

    scientific:
      apiData.scientific_name ||
      apiData.scientific ||
      ref.scientific ||
      "",

    origin:
      apiData.origin ||
      ref.origin ||
      "—",

    bodySize:
      apiData.body_size ||
      apiData.bodySize ||
      ref.bodySize ||
      "—",

    purpose:
      apiData.purpose ||
      ref.purpose ||
      "—",

    specialFeatures:
      apiData.special_features ||
      apiData.specialFeatures ||
      ref.specialFeatures ||
      "—",

    characteristics:
      Array.isArray(
        apiData.characteristics
      )
        ? apiData.characteristics
        : ref.characteristics || [],

    suitedFor:
      Array.isArray(
        apiData.suited_for
      )
        ? apiData.suited_for
        : Array.isArray(
            apiData.suitedFor
          )
        ? apiData.suitedFor
        : ref.suitedFor || []
  };
}


/* ============================================================
   CHARACTERISTICS
   ============================================================ */

function renderTraits(list) {
  const html =
    Array.isArray(list) &&
    list.length
      ? list
          .map(
            (item) =>
              `<li>${escapeHtml(item)}</li>`
          )
          .join("")
      : `<li class="muted">
           No characteristics available.
         </li>`;

  if (els.traitList) {
    els.traitList.innerHTML =
      html;
  }

  if (els.traitListBottom) {
    els.traitListBottom.innerHTML =
      html;
  }
}


function renderSuitedFor(list) {
  if (!els.suitedList) return;

  els.suitedList.innerHTML =
    Array.isArray(list) &&
    list.length
      ? list
          .map(
            (item) =>
              `<li>${escapeHtml(item)}</li>`
          )
          .join("")
      : `<li class="muted">
           No data available.
         </li>`;
}


/* ============================================================
   MOCK PREDICTION
   Only used if DEMO_FALLBACK = true
   ============================================================ */

function mockPrediction() {
  const data =
    typeof BREEDS_DATA !== "undefined"
      ? BREEDS_DATA
      : [];

  if (!data.length) {
    return {
      breed: "Gir",
      type: "Cattle",
      confidence: 0.91,
      scientific_name: "Bos indicus",
      origin: "Gujarat",
      body_size: "Large",
      purpose: "Milk Production",
      special_features:
        "Long ears and convex forehead",
      characteristics: [
        "Heat tolerant",
        "High milk yield"
      ],
      suited_for: [
        "Milk Production"
      ]
    };
  }

  const breed =
    data[
      Math.floor(
        Math.random() * data.length
      )
    ];

  return {
    breed: breed.name,
    type: breed.type,
    confidence:
      0.84 +
      Math.random() * 0.14,
    scientific_name:
      breed.scientific,
    origin:
      breed.origin,
    body_size:
      breed.bodySize,
    purpose:
      breed.purpose,
    special_features:
      breed.specialFeatures,
    characteristics:
      breed.characteristics,
    suited_for:
      breed.suitedFor
  };
}


/* ============================================================
   AUTH
   ============================================================ */

/* ---------------- REGISTER ---------------- */

async function registerUser({
    name,
    email,
    password
}) {
    try {
        const response = await fetch(
            apiUrl(`${CONFIG.AUTH_ENDPOINT}/register`),
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    name,
                    email,
                    password
                })
            }
        );

        const data = await readJsonResponse(response);

        console.log(
            "REGISTER RESPONSE:",
            data
        );

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.error ||
                "Registration failed"
            );
        }

        const authData = data.data || data;

        if (authData.token) {
          setToken(authData.token);
        }

        return authData.user || authData;

    } catch (error) {
        console.error(
            "REGISTER ERROR:",
            error
        );

        throw error;
    }
}


/* ---------------- LOGIN ---------------- */

async function loginUser({ email, password }) {
    try {
        const response = await fetch(
            apiUrl(`${CONFIG.AUTH_ENDPOINT}/login`),
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    email,
                    password
                })
            }
        );

        const data = await readJsonResponse(response);

        console.log("LOGIN RESPONSE:", data);

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.error ||
                "Login failed"
            );
        }

        const authData = data.data || data;

        if (!authData.token) {
            console.warn(
                "No token received from backend"
            );
        }

        if (authData.token) {
          setToken(authData.token);
        }

        return authData.user || authData;

    } catch (error) {
        console.error(
            "LOGIN ERROR:",
            error
        );

        throw error;
    }
}


/* ---------------- GET PROFILE ---------------- */

async function getProfile() {
  const token = getToken();

  if (!token) {
    return null;
  }

  const response =
    await fetch(
      apiUrl(
        `${CONFIG.AUTH_ENDPOINT}/me`
      ),
      {
        method: "GET",

        headers:
          getAuthHeaders()
      }
    );

  if (!response.ok) {
    if (
      response.status === 401 ||
      response.status === 403
    ) {
      setToken(null);
      setCurrentUser(null);
    }

    return null;
  }

  const data =
    await readJsonResponse(response);

  return (
    data.user ||
    data.data ||
    data
  );
}


/* ---------------- LOGOUT ---------------- */

async function logoutUser() {
  const token = getToken();

  try {
    if (token) {
      await fetch(
        apiUrl(
          `${CONFIG.AUTH_ENDPOINT}/logout`
        ),
        {
          method: "POST",

          headers:
            getAuthHeaders()
        }
      );
    }
  } catch (error) {
    console.warn(
      "Logout API error:",
      error
    );
  }

  setToken(null);
  setCurrentUser(null);
}


/* ============================================================
   AUTH UI
   ============================================================ */

function showAuthScreen() {
  if (authEls.screen) {
    authEls.screen.classList.remove(
      "hidden"
    );
  }

  if (authEls.dashboard) {
    authEls.dashboard.classList.add(
      "hidden"
    );
  }
}


function showDashboard(user) {
  if (authEls.screen) {
    authEls.screen.classList.add(
      "hidden"
    );
  }

  if (authEls.dashboard) {
    authEls.dashboard.classList.remove(
      "hidden"
    );
  }

  const label =
    user
      ? user.name ||
        user.username ||
        user.email
      : "Guest";

  if (authEls.sidebarUserName) {
    authEls.sidebarUserName.textContent =
      label;
  }

  if (authEls.sidebarUserAvatar) {
    authEls.sidebarUserAvatar.textContent =
      label
        .trim()
        .charAt(0)
        .toUpperCase() ||
      "G";
  }
}


/* ============================================================
   AUTH EVENT HANDLERS
   ============================================================ */

function wireAuth() {
  if (
    authEls.tabLogin &&
    authEls.tabRegister
  ) {
    authEls.tabLogin.addEventListener(
      "click",
      () => switchAuthTab("login")
    );

    authEls.tabRegister.addEventListener(
      "click",
      () => switchAuthTab("register")
    );
  }

  if (authEls.switchToRegister) {
    authEls.switchToRegister.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        switchAuthTab("register");
      }
    );
  }

  if (authEls.switchToLogin) {
    authEls.switchToLogin.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        switchAuthTab("login");
      }
    );
  }


  /* ---------------- LOGIN FORM ---------------- */

  if (authEls.loginForm) {
    authEls.loginForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        if (authEls.loginError) {
          authEls.loginError.textContent =
            "";
        }

        const formData =
          new FormData(
            authEls.loginForm
          );

        try {
          const user =
            await loginUser({
              email:
                String(
                  formData.get("email") ||
                    ""
                ).trim(),

              password:
                formData.get("password") ||
                ""
            });

          setCurrentUser(user);

          showDashboard(user);

          showToast(
            `Welcome back, ${
              user.name ||
              user.email ||
              "User"
            }!`
          );

          await loadPredictionHistory();

        } catch (error) {
          console.error(error);

          if (
            authEls.loginError
          ) {
            authEls.loginError.textContent =
              error.message;
          }
        }
      }
    );
  }


  /* ---------------- REGISTER FORM ---------------- */

  if (authEls.registerForm) {
    authEls.registerForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        if (authEls.registerError) {
          authEls.registerError.textContent =
            "";
        }

        const formData =
          new FormData(
            authEls.registerForm
          );

        try {
          const user =
            await registerUser({
              name:
                String(
                  formData.get("name") ||
                    ""
                ).trim(),

              email:
                String(
                  formData.get("email") ||
                    ""
                ).trim(),

              password:
                formData.get("password") ||
                ""
            });

          setCurrentUser(user);

          showDashboard(user);

          showToast(
            "Account created successfully!"
          );

          await loadPredictionHistory();

        } catch (error) {
          console.error(error);

          if (
            authEls.registerError
          ) {
            authEls.registerError.textContent =
              error.message;
          }
        }
      }
    );
  }


  /* ---------------- GUEST ---------------- */

  if (authEls.guestBtn) {
    authEls.guestBtn.addEventListener(
      "click",
      () => {
        setToken(null);
        setCurrentUser(null);

        showDashboard(null);

        showToast(
          "Continuing as guest."
        );
      }
    );
  }


  /* ---------------- LOGOUT ---------------- */

  if (authEls.logoutBtn) {
    authEls.logoutBtn.addEventListener(
      "click",
      async () => {
        await logoutUser();

        showAuthScreen();

        if (authEls.loginForm) {
          authEls.loginForm.reset();
        }

        if (authEls.registerForm) {
          authEls.registerForm.reset();
        }

        switchAuthTab("login");

        showToast(
          "Logged out successfully."
        );
      }
    );
  }
}


/* ============================================================
   AUTH TAB
   ============================================================ */

function switchAuthTab(which) {
  const isLogin =
    which === "login";

  if (authEls.tabLogin) {
    authEls.tabLogin.classList.toggle(
      "is-active",
      isLogin
    );

    authEls.tabLogin.setAttribute(
      "aria-selected",
      String(isLogin)
    );
  }

  if (authEls.tabRegister) {
    authEls.tabRegister.classList.toggle(
      "is-active",
      !isLogin
    );

    authEls.tabRegister.setAttribute(
      "aria-selected",
      String(!isLogin)
    );
  }

  if (authEls.loginForm) {
    authEls.loginForm.classList.toggle(
      "hidden",
      !isLogin
    );
  }

  if (authEls.registerForm) {
    authEls.registerForm.classList.toggle(
      "hidden",
      isLogin
    );
  }

  if (authEls.switchToRegisterText) {
    authEls.switchToRegisterText.classList.toggle(
      "hidden",
      !isLogin
    );
  }

  if (authEls.switchToLoginText) {
    authEls.switchToLoginText.classList.toggle(
      "hidden",
      isLogin
    );
  }

  if (authEls.loginError) {
    authEls.loginError.textContent =
      "";
  }

  if (authEls.registerError) {
    authEls.registerError.textContent =
      "";
  }
}


/* ============================================================
   PREDICTION HISTORY
  GET /api/predictions/history
   ============================================================ */

async function loadPredictionHistory() {
  const token = getToken();

  if (!token) {
    historyData = [];
    renderHistory([]);
    return;
  }

  try {
    const response =
      await fetch(
        apiUrl(
          `${CONFIG.PREDICTION_ENDPOINT}/history`
        ),
        {
          method: "GET",

          headers:
            getAuthHeaders()
        }
      );

    if (!response.ok) {
      throw new Error(
        `History request failed (${response.status})`
      );
    }

    const data =
      await readJsonResponse(response);

    historyData =
      data.predictions ||
      data.history ||
      data.data ||
      data ||
      [];

    if (!Array.isArray(historyData)) {
      historyData = [];
    }

    renderHistory(
      historyData
    );

  } catch (error) {
    console.error(
      "History API error:",
      error
    );

    historyData = [];

    renderHistory([]);

    if (
      error.message.includes(
        "401"
      ) ||
      error.message.includes(
        "403"
      )
    ) {
      setToken(null);
      setCurrentUser(null);
    }
  }
}


/* ============================================================
   RENDER HISTORY
   ============================================================ */

function renderHistory(
  backendHistory = null
) {
  if (!els.historyList) {
    return;
  }

  const list =
    backendHistory !== null
      ? backendHistory
      : historyData;

  if (!list.length) {
    els.historyList.innerHTML = `
      <p class="history-empty">
        No scans yet — upload an image to get started.
      </p>
    `;

    return;
  }

  els.historyList.innerHTML =
    list
      .slice(0, 6)
      .map((item) => {
        const breed =
          item.breed ||
          item.name ||
          item.predictedBreed ||
          "Unknown";

        const type =
          item.type ||
          item.animalType ||
          "";

        const confidence =
          item.confidence ??
          item.score ??
          item.probability;

        const image =
          item.imageUrl ||
          item.image ||
          item.imageDataUrl ||
          placeholderImg();

        const id =
          item._id ||
          item.id ||
          "";

        const date =
          item.createdAt ||
          item.date ||
          item.created_at;

        return `
          <div
            class="history-item"
            role="button"
            tabindex="0"
            data-id="${escapeHtml(id)}"
            data-name="${escapeHtml(breed)}"
          >

            <img
              src="${escapeHtml(image)}"
              alt="${escapeHtml(breed)}"
            >

            <div class="history-item__meta">
              <strong>
                ${escapeHtml(breed)}
              </strong>

              <span>
                ${escapeHtml(type)}
              </span>
            </div>

            <div class="history-item__right">
              <span class="history-score">
                ${formatConfidence(confidence)}
              </span>

              <time>
                ${formatDate(date)}
              </time>
            </div>

          </div>
        `;
      })
      .join("");

  els.historyList
    .querySelectorAll(
      ".history-item"
    )
    .forEach((node) => {
      node.addEventListener(
        "click",
        () => {
          const id =
            node.dataset.id;

          if (id) {
            loadPredictionById(id);
          } else {
            openBreedModalByName(
              node.dataset.name
            );
          }
        }
      );
    });
}


/* ============================================================
   GET SINGLE PREDICTION
  GET /api/predictions/:id
   ============================================================ */

async function loadPredictionById(
  id
) {
  if (!id) return;

  try {
    const response =
      await fetch(
        apiUrl(
          `${CONFIG.PREDICTION_ENDPOINT}/${encodeURIComponent(id)}`
        ),
        {
          method: "GET",

          headers:
            getAuthHeaders()
        }
      );

    if (!response.ok) {
      throw new Error(
        `Prediction request failed (${response.status})`
      );
    }

    const data =
      await readJsonResponse(response);

    const prediction =
      data.prediction ||
      data.data ||
      data;

    const image =
      prediction.imageUrl ||
      prediction.image ||
      prediction.imageDataUrl ||
      null;

    renderPrediction(
      prediction,
      image,
      data
    );

  } catch (error) {
    console.error(
      "Prediction details error:",
      error
    );

    showToast(
      "Unable to load prediction details."
    );
  }
}


/* ============================================================
   BREEDS API
   GET /api/breeds
   ============================================================ */

async function loadBreedsFromBackend() {
  try {
    const response =
      await fetch(
        apiUrl(
          CONFIG.BREED_ENDPOINT
        )
      );

    if (!response.ok) {
      throw new Error(
        `Breeds request failed (${response.status})`
      );
    }

    const data =
      await readJsonResponse(response);

    backendBreeds =
      data.breeds ||
      data.data ||
      data ||
      [];

    if (!Array.isArray(backendBreeds)) {
      backendBreeds = [];
    }

    renderBreedsGrid();

  } catch (error) {
    console.warn(
      "Could not load breeds from backend:",
      error
    );

    // Use local BREEDS_DATA as fallback
    backendBreeds = [];

    renderBreedsGrid();
  }
}


/* ============================================================
   GET BREED BY ID OR LABEL
   GET /api/breeds/:idOrLabel
   ============================================================ */

async function loadBreedByIdOrLabel(
  idOrLabel
) {
  try {
    const response =
      await fetch(
        apiUrl(
          `${CONFIG.BREED_ENDPOINT}/${encodeURIComponent(idOrLabel)}`
        )
      );

    if (!response.ok) {
      throw new Error(
        `Breed request failed (${response.status})`
      );
    }

    const data =
      await readJsonResponse(response);

    return (
      data.breed ||
      data.data ||
      data
    );

  } catch (error) {
    console.error(
      "Breed API error:",
      error
    );

    return null;
  }
}


/* ============================================================
   FIND BREED
   ============================================================ */

function getAllBreedsForUI() {
  if (
    Array.isArray(backendBreeds) &&
    backendBreeds.length
  ) {
    return backendBreeds;
  }

  if (
    typeof BREEDS_DATA !== "undefined" &&
    Array.isArray(BREEDS_DATA)
  ) {
    return BREEDS_DATA;
  }

  return [];
}


function normalizeBreed(breed) {
  return {
    name:
      breed.name ||
      breed.label ||
      breed.breed ||
      "Unknown",

    type:
      breed.type ||
      breed.animalType ||
      breed.animal_type ||
      "",

    scientific:
      breed.scientific ||
      breed.scientific_name ||
      "",

    origin:
      breed.origin ||
      "—",

    bodySize:
      breed.bodySize ||
      breed.body_size ||
      "—",

    purpose:
      breed.purpose ||
      "—",

    specialFeatures:
      breed.specialFeatures ||
      breed.special_features ||
      "—",

    characteristics:
      Array.isArray(
        breed.characteristics
      )
        ? breed.characteristics
        : [],

    suitedFor:
      Array.isArray(
        breed.suitedFor
      )
        ? breed.suitedFor
        : Array.isArray(
            breed.suited_for
          )
        ? breed.suited_for
        : [],

    image:
      breed.image ||
      breed.imageUrl ||
      breed.image_url ||
      placeholderImg(),

    tags:
      Array.isArray(breed.tags)
        ? breed.tags
        : []
  };
}


function findBreedByName(
  name
) {
  if (!name) {
    return null;
  }

  const breeds =
    getAllBreedsForUI()
      .map(normalizeBreed);

  const search =
    String(name)
      .trim()
      .toLowerCase();

  return (
    breeds.find(
      (breed) =>
        breed.name
          .toLowerCase() ===
        search
    ) ||
    breeds.find(
      (breed) =>
        breed.name
          .toLowerCase()
          .includes(search) ||
        search.includes(
          breed.name.toLowerCase()
        )
    ) ||
    null
  );
}


/* ============================================================
   BREEDS GRID
   ============================================================ */

function renderBreedsGrid() {
  if (!els.breedsGrid) {
    return;
  }

  const breeds =
    getAllBreedsForUI()
      .map(normalizeBreed);

  const query =
    (
      els.breedSearch?.value ||
      ""
    )
      .trim()
      .toLowerCase();

  const filtered =
    breeds.filter(
      (breed) => {
        const matchesFilter =
          activeFilter === "All" ||
          breed.type ===
            activeFilter ||
          breed.tags.includes(
            activeFilter
          );

        const matchesSearch =
          !query ||
          breed.name
            .toLowerCase()
            .includes(query);

        return (
          matchesFilter &&
          matchesSearch
        );
      }
    );

  if (!filtered.length) {
    els.breedsGrid.innerHTML = `
      <div class="breed-tile-empty">
        No breeds match your search.
      </div>
    `;

    return;
  }

  els.breedsGrid.innerHTML =
    filtered
      .map(
        (breed) => `
          <button
            class="breed-tile"
            data-name="${escapeHtml(
              breed.name
            )}"
          >

            <img
              src="${escapeHtml(
                breed.image
              )}"
              alt="${escapeHtml(
                breed.name
              )}"
              loading="lazy"
            >

            <div class="breed-tile__label">
              <strong>
                ${escapeHtml(
                  breed.name
                )}
              </strong>

              <span>
                ${escapeHtml(
                  breed.type
                )}
              </span>
            </div>

          </button>
        `
      )
      .join("");

  els.breedsGrid
    .querySelectorAll(
      ".breed-tile"
    )
    .forEach((tile) => {
      tile.addEventListener(
        "click",
        () =>
          openBreedModalByName(
            tile.dataset.name
          )
      );
    });
}


/* ============================================================
   BREEDS PANEL
   ============================================================ */

function wireBreedsPanel() {
  if (els.breedSearch) {
    els.breedSearch.addEventListener(
      "input",
      renderBreedsGrid
    );
  }

  if (els.filterPills) {
    els.filterPills.addEventListener(
      "click",
      (event) => {
        const pill =
          event.target.closest(
            ".pill"
          );

        if (!pill) return;

        activeFilter =
          pill.dataset.filter ||
          "All";

        els.filterPills
          .querySelectorAll(
            ".pill"
          )
          .forEach((item) =>
            item.classList.toggle(
              "is-active",
              item === pill
            )
          );

        renderBreedsGrid();
      }
    );
  }

  if (els.viewAllBreedsBtn) {
    els.viewAllBreedsBtn.addEventListener(
      "click",
      () => {
        activeFilter = "All";

        if (els.breedSearch) {
          els.breedSearch.value =
            "";
        }

        if (els.filterPills) {
          els.filterPills
            .querySelectorAll(
              ".pill"
            )
            .forEach((pill) =>
              pill.classList.toggle(
                "is-active",
                pill.dataset.filter ===
                  "All"
              )
            );
        }

        renderBreedsGrid();

        document
          .querySelector(
            ".breeds-card"
          )
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });

        showToast(
          "Displaying all cattle & buffalo breeds."
        );
      }
    );
  }

  if (els.viewAllHistory) {
    els.viewAllHistory.addEventListener(
      "click",
      (event) => {
        event.preventDefault();

        document
          .querySelector(
            ".history-card"
          )
          ?.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
      }
    );
  }
}


/* ============================================================
   BREED MODAL
   ============================================================ */

async function openBreedModalByName(
  name
) {
  if (!name) return;

  let breed =
    findBreedByName(name);

  // Try backend if local data wasn't found
  if (!breed) {
    breed =
      await loadBreedByIdOrLabel(
        name
      );

    if (breed) {
      breed =
        normalizeBreed(breed);
    }
  }

  if (!breed) {
    showToast(
      "No details available for this breed."
    );

    return;
  }

  if (!els.modalContent) {
    return;
  }

  els.modalContent.innerHTML = `
    <div class="modal-breed">

      <img
        src="${escapeHtml(
          breed.image
        )}"
        alt="${escapeHtml(
          breed.name
        )}"
      >

      <h3>
        ${escapeHtml(
          breed.name
        )}
      </h3>

      <p class="latin">
        ${
          breed.scientific
            ? `(${escapeHtml(
                breed.scientific
              )})`
            : ""
        }
      </p>

      <table>

        <tr>
          <td>Origin</td>
          <td>
            ${escapeHtml(
              breed.origin
            )}
          </td>
        </tr>

        <tr>
          <td>Breed Type</td>
          <td>
            ${escapeHtml(
              breed.type
            )}
          </td>
        </tr>

        <tr>
          <td>Body Size</td>
          <td>
            ${escapeHtml(
              breed.bodySize
            )}
          </td>
        </tr>

        <tr>
          <td>Purpose</td>
          <td>
            ${escapeHtml(
              breed.purpose
            )}
          </td>
        </tr>

        <tr>
          <td>Special Features</td>
          <td>
            ${escapeHtml(
              breed.specialFeatures
            )}
          </td>
        </tr>

      </table>

      <ul class="trait-list">

        ${
          breed.characteristics
            .map(
              (item) =>
                `<li>${escapeHtml(
                  item
                )}</li>`
            )
            .join("")
        }

      </ul>

    </div>
  `;

  if (els.modal) {
    els.modal.classList.add(
      "is-open"
    );
  }
}


function wireModal() {
  if (els.modalClose) {
    els.modalClose.addEventListener(
      "click",
      () => {
        els.modal?.classList.remove(
          "is-open"
        );
      }
    );
  }

  if (els.modal) {
    els.modal.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          els.modal
        ) {
          els.modal.classList.remove(
            "is-open"
          );
        }
      }
    );
  }

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape"
      ) {
        els.modal?.classList.remove(
          "is-open"
        );
      }
    }
  );
}


/* ============================================================
   RESULT BUTTONS
   ============================================================ */

function wireResultCtas() {
  if (els.viewFullInfoBtn) {
    els.viewFullInfoBtn.addEventListener(
      "click",
      () => {
        if (lastPrediction) {
          openBreedModalByName(
            lastPrediction.breed
          );
        }
      }
    );
  }

  if (els.viewSimilarBtn) {
    els.viewSimilarBtn.addEventListener(
      "click",
      () => {
        if (!lastPrediction) {
          return;
        }

        activeFilter =
          lastPrediction.type ||
          "All";

        if (els.filterPills) {
          els.filterPills
            .querySelectorAll(
              ".pill"
            )
            .forEach((pill) =>
              pill.classList.toggle(
                "is-active",
                pill.dataset.filter ===
                  activeFilter
              )
            );
        }

        renderBreedsGrid();

        document
          .querySelector(
            ".breeds-card"
          )
          ?.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
      }
    );
  }

  if (els.learnMoreBtn) {
    els.learnMoreBtn.addEventListener(
      "click",
      () => {
        document
          .querySelector(
            ".steps"
          )
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
      }
    );
  }
}


/* ============================================================
   SIDEBAR NAVIGATION
   ============================================================ */

function wireNavigation() {
  const navItems =
    document.querySelectorAll(
      ".nav__item"
    );

  navItems.forEach((item) => {
    item.addEventListener(
      "click",
      async (event) => {
        event.preventDefault();

        navItems.forEach(
          (nav) =>
            nav.classList.remove(
              "is-active"
            )
        );

        item.classList.add(
          "is-active"
        );

        const view =
          item.dataset.view;

        await handleSidebarViewClick(
          view
        );
      }
    );
  });
}


async function handleSidebarViewClick(
  view
) {
  document
    .querySelectorAll(
      ".view-panel"
    )
    .forEach((panel) =>
      panel.classList.add(
        "hidden"
      )
    );

  switch (view) {
    case "home":
      document
        .getElementById(
          "viewHome"
        )
        ?.classList.remove(
          "hidden"
        );
      break;

    case "history":
      document
        .getElementById(
          "viewHistory"
        )
        ?.classList.remove(
          "hidden"
        );

      await loadPredictionHistory();
      break;

    case "breeds":
      document
        .getElementById(
          "viewBreeds"
        )
        ?.classList.remove(
          "hidden"
        );

      await loadBreedsFromBackend();
      break;

    case "about":
      document
        .getElementById(
          "viewAbout"
        )
        ?.classList.remove(
          "hidden"
        );
      break;

    case "settings":
      document
        .getElementById(
          "viewSettings"
        )
        ?.classList.remove(
          "hidden"
        );
      break;

    case "help":
      document
        .getElementById(
          "viewHelp"
        )
        ?.classList.remove(
          "hidden"
        );
      break;

    default:
      document
        .getElementById(
          "viewHome"
        )
        ?.classList.remove(
          "hidden"
        );
  }
}


/* ============================================================
   DARK MODE
   ============================================================ */

function wireDarkMode() {
  const toggle =
    document.querySelector(
      "#darkModeToggle"
    );

  if (!toggle) return;

  const isDark =
    localStorage.getItem(
      "theme"
    ) === "dark";

  if (isDark) {
    document.body.classList.add(
      "dark-mode"
    );

    toggle.checked = true;
  }

  toggle.addEventListener(
    "change",
    (event) => {
      if (event.target.checked) {
        document.body.classList.add(
          "dark-mode"
        );

        localStorage.setItem(
          "theme",
          "dark"
        );
      } else {
        document.body.classList.remove(
          "dark-mode"
        );

        localStorage.setItem(
          "theme",
          "light"
        );
      }
    }
  );
}


/* ============================================================
   INITIALIZE DASHBOARD
   ============================================================ */

function initDashboard() {
  wireNavigation();
  wireUploadTriggers();
  wireBreedsPanel();
  wireModal();
  wireResultCtas();
  wireDarkMode();

  setResultState("empty");

  renderBreedsGrid();

  if (getToken()) {
    loadPredictionHistory();
  }

  // Load breeds from MongoDB/API
  loadBreedsFromBackend();
}


/* ============================================================
   INITIALIZE APPLICATION
   ============================================================ */

async function init() {
  wireAuth();
  initDashboard();

  const token =
    getToken();

  if (token) {
    try {
      const user =
        await getProfile();

      if (user) {
        setCurrentUser(user);
        showDashboard(user);

        await loadPredictionHistory();

        return;
      }
    } catch (error) {
      console.warn(
        "Session validation failed:",
        error
      );
    }
  }

  const existingUser =
    getCurrentUser();

  if (existingUser) {
    showDashboard(
      existingUser
    );
  } else {
    showAuthScreen();
  }
}


/* ============================================================
   START
   ============================================================ */

document.addEventListener(
  "DOMContentLoaded",
  init
);