const firebaseConfig = {
  apiKey: "AIzaSyCorsisrGvyszMUQ6NpN5d_5XMa-j9Msj0",
  authDomain: "tuaworsmartfarm.firebaseapp.com",
  databaseURL: "https://tuaworsmartfarm-default-rtdb.firebaseio.com",
  projectId: "tuaworsmartfarm",
  storageBucket: "tuaworsmartfarm.appspot.com",
  messagingSenderId: "605653634791",
  appId: "1:605653634791:web:ec3f48c97a919a36795972",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const pumpModes = {};
let globalConfig = {};
const pumps = [1, 2, 3];

function getThaiDateTime(date) {
  const d = date.getDate(),
    m = date.getMonth() + 1,
    y = date.getFullYear() + 543;
  const h = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  return `วันที่ ${d}/${m}/${y} เวลา ${h}:${min} น.`;
}

async function loadWeather() {
  const res = await fetch(
    "https://api.openweathermap.org/data/2.5/weather?lat=13.7563&lon=100.5018&units=metric&lang=th&appid=3fe26da4919fb8c89e790fab6d6ab83f"
  );
  const data = await res.json();

  const temp = data.main.temp.toFixed(1);
  const humidity = data.main.humidity;
  const light = data.weather[0].description;

  const tempEl = document.getElementById("temp");
  if (tempEl) tempEl.textContent = `🌡️ ${temp}°C`;

  const humidityEl = document.getElementById("humidity");
  if (humidityEl) humidityEl.textContent = `💧 ${humidity}%`;

  const lightEl = document.getElementById("light");
  if (lightEl) lightEl.textContent = `🌤️ ${light}`;

  return { temp: parseFloat(temp), humidity, light };
}

function togglePump(pump) {
  const sw = document.getElementById(`pump0${pump}Switch`);
  const status = sw.checked ? "ON" : "OFF";
  db.ref(`pump_0${pump}/status`).set(status);
  document.getElementById(`pump0${pump}Status`).textContent = sw.checked
    ? "เปิด"
    : "ปิด";
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
  document.getElementById(`pump0${pump}Start`).textContent = sw.checked
    ? time
    : "--:--";
  document.getElementById(`pump0${pump}Humidity`).textContent = sw.checked
    ? Math.floor(Math.random() * 30 + 30) + "°C"
    : "--°C";
}

function autoControl() {
  if (!globalConfig || Object.keys(pumpModes).length < 3) return;
  const now = new Date();
  const nowTime = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
  const tempText = (document.getElementById("temp") || {}).textContent || "";
  const temp = parseFloat((tempText.match(/([\d.]+)/) || [])[0] || 0);

  for (let i = 1; i <= 3; i++) {
    if (pumpModes[i] === "auto") {
      const { startTime, endTime, tempThreshold } = globalConfig;
      const shouldOn =
        startTime <= nowTime && nowTime <= endTime && temp > tempThreshold;
      db.ref(`pump_0${i}/status`).set(shouldOn ? "ON" : "OFF");
      document.getElementById(`pump0${i}Switch`).checked = shouldOn;
      document.getElementById(`pump0${i}Status`).textContent = shouldOn
        ? "เปิด"
        : "ปิด";
    }
  }
}

function loadDataFromFirebase() {
  return new Promise((resolve) => {
    const totalToLoad = 1 + pumps.length;
    let loaded = 0;

    function checkLoaded() {
      loaded++;
      if (loaded === totalToLoad) resolve();
    }

    db.ref("globalConfig").on("value", (snap) => {
      globalConfig = snap.val();
      checkLoaded();
    });

    for (let i of pumps) {
      db.ref(`pump_0${i}`).on("value", (snap) => {
        const val = snap.val();
        pumpModes[i] = val.mode || "manual";

        const statusEl = document.getElementById(`pump${i}`);
        if (statusEl)
          statusEl.textContent = val.status === "ON" ? "⛈️ เปิด" : "✊ ปิด";

        document.getElementById(`pump0${i}Switch`).checked =
          val.status === "ON";
        document.getElementById(`pump0${i}Switch`).disabled =
          pumpModes[i] === "auto";
        document.getElementById(`pump0${i}Status`).textContent =
          val.status === "ON" ? "เปิด" : "ปิด";

        checkLoaded();
      });
    }

    const updateEl = document.getElementById("lastUpdate");
    if (updateEl) updateEl.textContent = getThaiDateTime(new Date());
  });
}

function renderPumpSetting(pumpId) {
  return `
    <div class="pump-setting" id="pump${pumpId}Setting">
      <div class="setting-header">
        <span class="label">ปั้ม 0${pumpId}</span>
        <label class="toggleSwitch">
          <input type="checkbox" id="modeToggle${pumpId}" onchange="toggleMode(${pumpId})">
          <span class="slider"></span>
        </label>
      </div>
      <div class="mode-labels">
        <span>โหมด</span>
        <span id="modeLabel${pumpId}">--</span>
      </div>
    </div>
  `;
}

function toggleMode(pumpId) {
  const isAuto = document.getElementById(`modeToggle${pumpId}`).checked;
  const mode = isAuto ? "auto" : "manual";

  db.ref(`pump_0${pumpId}/mode`)
    .set(mode)
    .then(() => {
      console.log(`✅ อัปเดต mode: pump_0${pumpId} = ${mode}`);

      if (mode === "manual") {
        db.ref(`pump_0${pumpId}/status`)
          .once("value")
          .then((snapshot) => {
            const currentStatus = snapshot.val();
            if (currentStatus === "ON") {
              db.ref(`pump_0${pumpId}/status`).set("OFF");
              document.getElementById(`pump0${pumpId}Switch`).checked = false;
              document.getElementById(`pump0${pumpId}Status`).textContent =
                "ปิด";
              document.getElementById(`pump0${pumpId}Start`).textContent =
                "--:--";
              document.getElementById(`pump0${pumpId}Humidity`).textContent =
                "--°C";
            }
          });
      }
    })
    .catch((err) => console.error("❌ ล้มเหลว:", err));
}

function saveGlobalConfig() {
  const startTimeEl = document.getElementById("startTime");
  const endTimeEl = document.getElementById("endTime");
  const tempEl = document.getElementById("tempThreshold");

  const startTime = startTimeEl ? startTimeEl.value : "";
  const endTime = endTimeEl ? endTimeEl.value : "";
  const tempThreshold = tempEl ? parseInt(tempEl.value) : 0;

  const config = { startTime, endTime, tempThreshold };

  db.ref("globalConfig")
    .set(config)
    .then(() => console.log("✅ บันทึก globalConfig แล้ว"))
    .catch((err) => console.error("❌ ล้มเหลว:", err));
}

function loadSettings() {
  const area = document.getElementById("settingsArea");
  if (!area) return;
  area.innerHTML = "";

  pumps.forEach((pumpId) => {
    area.innerHTML += renderPumpSetting(pumpId);
  });

  pumps.forEach((pumpId) => {
    const toggle = document.getElementById(`modeToggle${pumpId}`);
    const label = document.getElementById(`modeLabel${pumpId}`);

    if (!toggle || !label) return; // ถ้าไม่เจอ element ก็ข้ามเลย

    db.ref(`pump_0${pumpId}/mode`).on("value", (snapshot) => {
      const mode = snapshot.val() || "manual";
      const isAuto = mode === "auto";

      toggle.onchange = null;
      toggle.checked = isAuto;
      label.textContent = capitalize(mode);
      toggle.onchange = () => toggleMode(pumpId);
    });
  });

  db.ref("globalConfig")
    .once("value")
    .then((snapshot) => {
      const cfg = snapshot.val() || {};
      const startEl = document.getElementById("startTime");
      const endEl = document.getElementById("endTime");
      const tempEl = document.getElementById("tempThreshold");

      if (startEl) startEl.value = cfg.startTime || "";
      if (endEl) endEl.value = cfg.endTime || "";
      if (tempEl) tempEl.value = cfg.tempThreshold || "";
    });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

window.onload = async () => {
  await loadWeather();
  await loadDataFromFirebase();

  if (document.getElementById("settingsArea")) {
    loadSettings();
  }

  autoControl();
  setInterval(autoControl, 3000);
};