// Firebase Config
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

function togglePump(pump) {
  const now = new Date();
  const { time: timeStr } = getDateTime(now);
  const sw = document.getElementById(`pump0${pump}Switch`);
  if (!sw) return;

  const status = sw.checked ? "ON" : "OFF";

  db.ref(`pump_0${pump}/status`).once("value").then((snap) => {
    const prevStatus = snap.val();
    if (status === prevStatus) return;

    db.ref(`pump_0${pump}/status`).set(status);

    const startEl = document.getElementById(`pump0${pump}Start`);
    const humidityEl = document.getElementById(`pump0${pump}Humidity`);

    if (status === "ON") {
      db.ref(`pump_0${pump}/strTime`).set(timeStr);
      if (startEl) startEl.textContent = timeStr;
      if (humidityEl) humidityEl.textContent = Math.floor(Math.random() * 30 + 30) + "°C";
    } else {
      if (startEl) startEl.textContent = "--:--";
      if (humidityEl) humidityEl.textContent = "--°C";
    }
  });
}

function autoControl() {
  if (!globalConfig || Object.keys(pumpModes).length < 3) return;

  const now = new Date();
  const { time: nowTime } = getDateTime(now);
  const tempText = (document.getElementById("temp") || {}).textContent || "";
  const temp = parseFloat((tempText.match(/([\d.]+)/) || [])[0] || 0);

  console.log("เวลา:", nowTime, "อุณหภูมิ:", temp);

  const slots = globalConfig.timeSlots || [{ start: globalConfig.startTime, end: globalConfig.endTime }];

  function isInAnyTimeSlot(time) {
    return slots.some(({ start, end }) => start <= time && time <= end);
  }

  for (let i = 1; i <= 3; i++) {
    if (pumpModes[i] === "auto") {
      const shouldOn = isInAnyTimeSlot(nowTime) && temp > globalConfig.tempThreshold;
      console.log(`ปั้ม ${i}: ควรเปิด?`, shouldOn);

      const sw = document.getElementById(`pump0${i}Switch`);
      const isCurrentlyOn = sw?.checked;

      if (shouldOn && !isCurrentlyOn) {
        console.log(`เปิดปั้ม ${i}`);
        sw.checked = true;
        togglePump(i);
      } else if (!shouldOn && isCurrentlyOn) {
        console.log(`ปิดปั้ม ${i}`);
        sw.checked = false;
        togglePump(i);
      }
    }
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
  const tempEl = document.getElementById("tempThreshold");
  const tempThreshold = tempEl ? parseInt(tempEl.value) : 0;

  const timeSlots = [];
  const rows = document.querySelectorAll("#timeSlotsContainer .time-row");
  rows.forEach(row => {
    const start = row.querySelector(".startTime")?.value || "";
    const end = row.querySelector(".endTime")?.value || "";
    if (start && end) timeSlots.push({ start, end });
  });

  db.ref("globalConfig")
    .set({ tempThreshold, timeSlots })
    .then(() => console.log("✅ บันทึก timeSlots สำเร็จ"))
    .catch(err => console.error("❌ บันทึกไม่สำเร็จ:", err));
}

function loadSettings() {
  const area = document.getElementById("settingsArea");
  if (!area) return;

  area.innerHTML = pumps.map(pumpId => renderPumpSetting(pumpId)).join("");

  pumps.forEach(pumpId => {
    const toggle = document.getElementById(`modeToggle${pumpId}`);
    const label = document.getElementById(`modeLabel${pumpId}`);

    if (!toggle || !label) return;

    db.ref(`pump_0${pumpId}/mode`).on("value", snapshot => {
      const mode = snapshot.val() || "manual";
      toggle.checked = mode === "auto";
      label.textContent = capitalize(mode);
      toggle.onchange = () => toggleMode(pumpId);
    });
  });

  db.ref("globalConfig").once("value").then(snapshot => {
    const cfg = snapshot.val() || {};
    document.getElementById("tempThreshold").value = cfg.tempThreshold || "";

    const container = document.getElementById("timeSlotsContainer");
    container.innerHTML = (cfg.timeSlots || []).map(slot => 
      `<div class="time-row">
        <label>เริ่มเวลา</label>
        <input type="time" class="startTime" value="${slot.start}" />
        <label>สิ้นสุดเวลา</label>
        <input type="time" class="endTime" value="${slot.end}" />
        <button class="remove-btn" onclick="removeTimeSlot(this)">ลบ</button>
      </div>`
    ).join("");

    container.querySelectorAll("input").forEach(input => {
      input.addEventListener("change", saveGlobalConfig);
    });
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
  try {
    const res = await fetch("https://api.openweathermap.org/data/2.5/weather?lat=13.7563&lon=100.5018&units=metric&lang=th&appid=3fe26da4919fb8c89e790fab6d6ab83f");
    const data = await res.json();

    const temp = data.main.temp.toFixed(1);
    const humidity = data.main.humidity;
    const light = data.weather[0].description;

    document.getElementById("temp").textContent = `🌡️ ${temp}°C`;
    document.getElementById("humidity").textContent = `💧 ${humidity}%`;
    document.getElementById("light").textContent = `🌤️ ${light}`;

    return { temp: parseFloat(temp), humidity, light };
  } catch (err) {
    console.error("❌ Weather API Error:", err);
  }
}

function addTimeSlot(start = "", end = "") {
  const container = document.getElementById("timeSlotsContainer");

  const slotDiv = document.createElement("div");
  slotDiv.className = "time-row";

  slotDiv.innerHTML = `
    <label>เริ่มเวลา</label>
    <input type="time" class="startTime" value="${start}" />
    <label>สิ้นสุดเวลา</label>
    <input type="time" class="endTime" value="${end}" />
    <button class="remove-btn" onclick="removeTimeSlot(this)">ลบ</button>
  `;

  // บันทึกเมื่อมีการเปลี่ยนแปลงค่า
  slotDiv.querySelectorAll("input").forEach(input => {
    input.addEventListener("change", saveGlobalConfig);
  });

  container.appendChild(slotDiv);
  saveGlobalConfig();
}

function removeTimeSlot(btn) {
  const slotDiv = btn.parentElement;
  slotDiv.remove();
  saveGlobalConfig(); // บันทึกหลังลบ
}

window.onload = async () => {
  await loadWeather();
  await loadDataFromFirebase();
  if (document.getElementById("settingsArea")) {
    loadSettings();
  }
  timeUpdate();
  setInterval(timeUpdate, 1000);
  autoControl();
  setInterval(autoControl, 1000);
};
