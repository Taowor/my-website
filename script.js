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
        const val = snap.val() || {};
        pumpModes[i] = val.mode || "manual";

        const statusEl = document.getElementById(`pump${i}`);
        if (statusEl) statusEl.textContent = val.status === "ON" ? "⛈️ เปิด" : "✊ ปิด";

        const sw = document.getElementById(`pump0${i}Switch`);
        const statusText = document.getElementById(`pump0${i}Status`);
        const modeText = document.getElementById(`pump0${i}Mode`);
        if (sw) {
          sw.checked = val.status === "ON";
          sw.disabled = pumpModes[i] === "auto";
        }
        if (statusText) statusText.textContent = val.status === "ON" ? "เปิด" : "ปิด";
        if (modeText) modeText.textContent = pumpModes[i] === "auto" ? "Auto" : "Manual";

        checkLoaded();
      });
    }
  });
}

function autoControl() {
  if (!globalConfig || Object.keys(pumpModes).length < 3) return;

  const now = new Date();
  const { time: nowTime } = getDateTime(now); // ดึงเวลา HH:mm
  const tempText = (document.getElementById("temp") || {}).textContent || "";
  const temp = parseFloat((tempText.match(/([\d.]+)/) || [])[0] || 0);

  for (let i = 1; i <= 3; i++) {
    if (pumpModes[i] === "auto") {
      const { startTime, endTime, tempThreshold } = globalConfig;
      const shouldOn = startTime <= nowTime && nowTime <= endTime && temp > tempThreshold;

      const sw = document.getElementById(`pump0${i}Switch`);
      const isCurrentlyOn = sw?.checked;

      // เรียกใช้ togglePump เฉพาะตอนเปลี่ยนสถานะ
      if (shouldOn && !isCurrentlyOn) {
        sw.checked = true;
        togglePump(i);
      } else if (!shouldOn && isCurrentlyOn) {
        sw.checked = false;
        togglePump(i);
      }
    }
  }
}


function togglePump(pump) {
  //แสดงเวลาเริ่มทำงาน
  const now = new Date();
  const { time: timeStr } = getDateTime(now);
  const sw = document.getElementById(`pump0${pump}Switch`);
  if (!sw) return;

  const status = sw.checked ? "ON" : "OFF";
  
  const startEl = document.getElementById(`pump0${pump}Start`);
  const humidityEl = document.getElementById(`pump0${pump}Humidity`);

  if (status === "ON") {
    db.ref(`pump_0${pump}/status`).set(status);
    db.ref(`pump_0${pump}/strTime`).set(timeStr);
    console.log(`ทำการบันทึกเวลาเรียบร้อยแล้ว`);
    if (startEl) startEl.textContent = timeStr;
    if (humidityEl) humidityEl.textContent = Math.floor(Math.random() * 30 + 30) + "°C";
  } else if (status === "OFF"){
    db.ref(`pump_0${pump}/status`).set(status);
    if (startEl) startEl.textContent = "--:--";
    if (humidityEl) humidityEl.textContent = "--°C";
  }
}


function toggleMode(pumpId) {
  const isAuto = document.getElementById(`modeToggle${pumpId}`).checked;
  const mode = isAuto ? "auto" : "manual";

  db.ref(`pump_0${pumpId}/mode`).set(mode)
    .then(() => {
      console.log(`✅ อัปเดต mode: pump_0${pumpId} = ${mode}`);

      if (mode === "manual") {
        db.ref(`pump_0${pumpId}/status`).once("value")
          .then((snapshot) => {
            const currentStatus = snapshot.val();
            if (currentStatus === "ON") {
              db.ref(`pump_0${pumpId}/status`).set("OFF");
              const sw = document.getElementById(`pump0${pumpId}Switch`);
              const statusText = document.getElementById(`pump0${pumpId}Status`);
              const startEl = document.getElementById(`pump0${pumpId}Start`);
              const humEl = document.getElementById(`pump0${pumpId}Humidity`);
              if (sw) sw.checked = false;
              if (statusText) statusText.textContent = "ปิด";
              if (startEl) startEl.textContent = "--:--";
              if (humEl) humEl.textContent = "--°C";
            }
          });
      }
    })
    .catch((err) => console.error("❌ ล้มเหลว:", err));
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

    if (!toggle || !label) return;

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

function getDateTime(date) {
  const days = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];

  const d = date.getDate();
  const m = date.getMonth();
  const y = date.getFullYear() + 543;
  const h = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  const dayName = days[date.getDay()];
  const monthName = months[m];

  return {
    thaiDateTime: `วัน${dayName}ที่ ${d} ${monthName} พ.ศ. ${y} เวลา ${h}:${min} น.`,
    date: `${d}/${m}/${y}`,
    time: `${h}:${min}`
  };
}

function timeUpdate() {
    const updateEl = document.getElementById("lastUpdate");
    const now = new Date();
    const { thaiDateTime } = getDateTime(now);
    if (updateEl) updateEl.textContent = thaiDateTime;
}

async function loadWeather() {
  const res = await fetch("https://api.openweathermap.org/data/2.5/weather?lat=13.7563&lon=100.5018&units=metric&lang=th&appid=3fe26da4919fb8c89e790fab6d6ab83f");
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

window.onload = async () => {
  await loadDataFromFirebase();
  await loadWeather();
  if (document.getElementById("settingsArea")) {
    loadSettings();
  }
  autoControl();
  setInterval(autoControl, 3000);
  timeUpdate();
  setInterval(timeUpdate, 3000);
};
