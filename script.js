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

// เริ่มต้น Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const pumpModes = {};
let globalConfig = {
  // ตั้งค่าพิกัดเริ่มต้นเป็นกรุงเทพฯ
  location: {
    lat: 13.7563,
    lon: 100.5018
  },
  tempThreshold: 30,
  humidityThreshold: 50, // ค่าเริ่มต้นสำหรับความชื้น
  weatherCondition: "Clear" // ค่าเริ่มต้นสำหรับสภาพอากาศ
};

let activePumpIds = []; // ID ปั้มที่ใช้งานจริง (จะถูกกำหนดค่าใน loadDataFromFirebase)

// ฟังก์ชันสำหรับสร้าง HTML ปั้มน้ำในหน้าหลัก
function renderPumpHomeOverview() {
    // ✅ แก้ไข: ลบการแสดงสถานะปั้มในภาพรวมออกตามที่ร้องขอ
    return '';
}

// ฟังก์ชันสำหรับสร้าง HTML ส่วนควบคุมปั้มน้ำในหน้าหลัก
function renderPumpHomeControls() {
    let controlsHTML = '';
    
    activePumpIds.sort((a, b) => a - b).forEach(i => {
        const pumpData = pumpModes[i] || {};
        const mode = pumpData.mode === "auto" ? "Auto" : "Manual";
        const status = pumpData.status === "ON";
        const strTime = pumpData.strTime || "--:--";
        
        controlsHTML += `
            <div class="pump-card">
              <div class="card-header">
                <span class="pump-label">ปั้ม <strong>${i.toString().padStart(2, '0')}</strong></span>
                <label class="toggleSwitch">
                  <input type="checkbox" id="pump0${i}Switch" onchange="togglePump(${i})" ${status ? 'checked' : ''} ${mode === 'Auto' ? 'disabled' : ''}/>
                  <span class="slider"></span>
                </label>
              </div>
              <div class="card-info">
                <div>Mode : <span id="pump0${i}Mode">${mode}</span></div>
                <div>
                  เริ่ม : <span id="pump0${i}Start">${strTime}</span> ค่าความชื้น :
                  <span id="pump0${i}Humidity">--%</span>
                </div>
              </div>
            </div>
        `;
    });
    
    return `<div class="pump-group">${controlsHTML}</div>`;
}

// ฟังก์ชันสำหรับอัปเดต UI หน้าหลัก
function renderHomeUI() {
    const overviewContainer = document.getElementById("pumpOverview");
    const controlContainer = document.getElementById("pumpControls");
    
    if (overviewContainer) overviewContainer.innerHTML = renderPumpHomeOverview();
    if (controlContainer) controlContainer.innerHTML = renderPumpHomeControls();
    
    // อัปเดตข้อมูลแปลงปลูกในหน้าหลักด้วย
    renderPlantingHomeSummary(); 
}


// โหลดข้อมูลทั้งหมดจาก Firebase เมื่อเริ่มต้น
function loadDataFromFirebase() {
  return new Promise((resolve) => {
    
    // 1. โหลด globalConfig และรายการ ID ปั้ม
    db.ref("globalConfig").on("value", (snap) => {
        const configSnap = snap.val() || {};
        globalConfig = configSnap;

        if (!globalConfig.location) globalConfig.location = { lat: 13.7563, lon: 100.5018 };
        if (!globalConfig.tempThreshold) globalConfig.tempThreshold = 30;
        if (!globalConfig.humidityThreshold) globalConfig.humidityThreshold = 50;
        if (!globalConfig.weatherCondition) globalConfig.weatherCondition = "Clear";
        
        if (!globalConfig.pumpIds || globalConfig.pumpIds.length === 0) {
            globalConfig.pumpIds = [1, 2, 3];
            db.ref("globalConfig/pumpIds").set(globalConfig.pumpIds);
        }
        activePumpIds = globalConfig.pumpIds;
        
        // 2. โหลดสถานะและโหมดของปั๊มแต่ละตัวแบบ Real-time
        activePumpIds.forEach(i => {
            db.ref(`pump_0${i}`).off("value"); 
            
            db.ref(`pump_0${i}`).on("value", (pumpSnap) => {
                pumpModes[i] = pumpSnap.val() || { mode: "manual", status: "OFF" };
                renderHomeUI(); 
            });
        });
        
        renderHomeUI();
        resolve(); 
    });
  });
}

// ควบคุมการเปิด-ปิดปั๊ม
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
      // แก้ไข: แสดงค่าความชื้นเป็น % (สมมติค่าความชื้นดิน 40-70%)
      if (humidityEl) humidityEl.textContent = Math.floor(Math.random() * 30 + 40) + "%"; 
    } else {
      if (startEl) startEl.textContent = "--:--";
      if (humidityEl) humidityEl.textContent = "--%"; 
    }
  });
}

// =========================================================
// ✅ Modal & CRUD Functions สำหรับปั้มน้ำ
// =========================================================

// ฟังก์ชันเปิด Modal สำหรับ เพิ่มหรือแก้ไข
function editPump(pumpId) {
    const formContainer = document.getElementById('pumpFormContainer');
    const pumpIdInput = document.getElementById('pumpIdInput');
    const originalIdInput = document.getElementById('originalPumpId');
    const formTitle = document.getElementById('pumpFormTitle');

    if (!formContainer) {
        console.error("⚠️ ไม่พบโครงสร้าง Pop-up ปั้มน้ำ กรุณาตรวจสอบ setting.html");
        return;
    }

    formContainer.style.display = 'flex'; 

    if (pumpId === 'new') {
        const maxId = activePumpIds.length > 0 ? Math.max(...activePumpIds) : 0;
        const nextPumpId = maxId + 1;
        
        formTitle.textContent = 'เพิ่มปั้มน้ำใหม่';
        pumpIdInput.value = nextPumpId;
        originalIdInput.value = '';
    } else {
        formTitle.textContent = `แก้ไขปั้มน้ำ ${pumpId.toString().padStart(2, '0')}`;
        pumpIdInput.value = pumpId;
        originalIdInput.value = pumpId;
    }
}

function closePumpForm() {
    const formContainer = document.getElementById('pumpFormContainer');
    if (formContainer) {
        formContainer.style.display = 'none';
    }
}

// ฟังก์ชันบันทึกรายละเอียดปั้ม (รวมตรรกะเพิ่มและแก้ไข)
function savePumpDetail() {
    const newPumpIdInput = document.getElementById('pumpIdInput');
    const originalPumpId = document.getElementById('originalPumpId').value;
    const newPumpId = parseInt(newPumpIdInput.value);

    if (!newPumpId || newPumpId <= 0 || !Number.isInteger(newPumpId)) {
        alert("หมายเลขปั้มต้องเป็นจำนวนเต็มบวก");
        return;
    }

    const isEditing = originalPumpId !== '';
    const originalPumpIdNum = isEditing ? parseInt(originalPumpId) : null;
    const isIdChanged = isEditing && newPumpId !== originalPumpIdNum;
    
    if (!isEditing || isIdChanged) {
        if (activePumpIds.includes(newPumpId)) {
            alert(`❌ หมายเลขปั้ม ${newPumpId} ถูกใช้งานอยู่แล้ว กรุณาเลือกหมายเลขอื่น`);
            return;
        }
    }
    
    const promises = [];
    
    if (isIdChanged) {
        globalConfig.pumpIds = globalConfig.pumpIds.filter(id => id !== originalPumpIdNum);
        promises.push(db.ref(`pump_0${originalPumpId}`).remove());
    }

    if (!activePumpIds.includes(newPumpId)) {
        globalConfig.pumpIds.push(newPumpId);
        globalConfig.pumpIds.sort((a, b) => a - b);
    }
    
    promises.push(db.ref("globalConfig/pumpIds").set(globalConfig.pumpIds));
    
    const currentPumpData = pumpModes[originalPumpIdNum] || { mode: "manual", status: "OFF", strTime: "--:--"};
    promises.push(db.ref(`pump_0${newPumpId}`).set(currentPumpData));


    Promise.all(promises)
        .then(() => {
            alert(`✅ บันทึกปั้มน้ำ ${newPumpId.toString().padStart(2, '0')} สำเร็จ`);
            closePumpForm();
            loadSettings();
        })
        .catch(err => {
            alert("❌ บันทึกไม่สำเร็จ: " + err.message);
        });
}

// ฟังก์ชันลบปั้ม
function deletePump(pumpId) {
    if (activePumpIds.length <= 1) {
        alert("ไม่สามารถลบปั้มตัวสุดท้ายได้");
        return;
    }
    
    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบปั้มน้ำ ${pumpId.toString().padStart(2, '0')} ออกจากระบบ? ข้อมูลทั้งหมดของปั้มนี้จะถูกลบ`)) {
        globalConfig.pumpIds = globalConfig.pumpIds.filter(id => id !== pumpId);
        db.ref("globalConfig/pumpIds").set(globalConfig.pumpIds)
            .then(() => {
                return db.ref(`pump_0${pumpId}`).remove();
            })
            .then(() => {
                console.log(`✅ ลบปั้มน้ำ ${pumpId.toString().padStart(2, '0')} สำเร็จ`);
                loadSettings();
            })
            .catch(err => {
                alert("❌ ลบปั้มไม่สำเร็จ: " + err.message);
            });
    }
}


// แสดงส่วนการตั้งค่าสำหรับปั๊มแต่ละตัว
function renderPumpSetting(pumpId) {
    const pumpData = pumpModes[pumpId] || {};
    const mode = pumpData.mode || "manual";

    return `
        <div class="pump-setting" id="pump${pumpId}Setting">
            <div class="setting-header">
                <span class="label">ปั้ม ${pumpId.toString().padStart(2, '0')}</span>
                <div class="plot-actions" style="margin-top: 0px; gap: 5px;">
                    <label class="toggleSwitch" style="margin-right: 5px;">
                        <input type="checkbox" id="modeToggle${pumpId}" onchange="toggleMode(${pumpId})" ${mode === 'auto' ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <button class="edit-btn" onclick="editPump(${pumpId})">✏️ แก้ไข</button> 
                    <button class="delete-btn" onclick="deletePump(${pumpId})">🗑️ ลบปั้ม</button>
                </div>
            </div>
            <div class="mode-labels">
                <span>โหมด</span>
                <span id="modeLabel${pumpId}">${capitalize(mode)}</span>
            </div>
        </div>
    `;
}

// โหลดการตั้งค่าจาก Firebase มาแสดงบนหน้าเว็บ
function loadSettings() {
  const area = document.getElementById("settingsArea"); 
  if (!area) return;

  area.innerHTML = ''; 

  const pumpsHtml = activePumpIds.sort((a, b) => a - b).map(pumpId => renderPumpSetting(pumpId)).join(""); 

  area.innerHTML = pumpsHtml;

  activePumpIds.forEach(pumpId => {
    const toggle = document.getElementById(`modeToggle${pumpId}`);
    const label = document.getElementById(`modeLabel${pumpId}`);

    if (!toggle || !label) return;

    const mode = pumpModes[pumpId]?.mode || "manual";
    toggle.checked = mode === "auto";
    label.textContent = capitalize(mode);
  });

  db.ref("globalConfig").once("value").then(snapshot => {
    const cfg = snapshot.val() || {};
    
    const tempThresholdEl = document.getElementById("tempThreshold");
    if (tempThresholdEl) tempThresholdEl.value = cfg.tempThreshold || "";
    
    const humidityThresholdEl = document.getElementById("humidityThreshold");
    if (humidityThresholdEl) humidityThresholdEl.value = cfg.humidityThreshold || 50;
    
    const weatherConditionEl = document.getElementById("weatherCondition");
    if (weatherConditionEl) weatherConditionEl.value = cfg.weatherCondition || "";
    
    const savedLocation = cfg.location || globalConfig.location;
    const locationInputEl = document.getElementById("locationInput");
    if (locationInputEl) locationInputEl.value = `${savedLocation.lat}, ${savedLocation.lon}`;
    

    const container = document.getElementById("timeSlotsContainer");
    container.innerHTML = (cfg.timeSlots || []).map(slot => 
      `<div class="time-row">
        <label>เริ่มเวลา</label>
        <input type="time" class="startTime" value="${slot.start}" />
        <label>สิ้นสุดเวลา</label>
        <input type="time" class="endTime" value="${slot.end}" />
        <button class="delete-btn" onclick="removeTimeSlot(this)">🗑️ ลบ</button>
      </div>`
    ).join("");

    container.querySelectorAll("input").forEach(input => {
      input.addEventListener("change", saveGlobalConfig);
    });
  });
}

// ฟังก์ชันควบคุมอัตโนมัติ
function autoControl() {
    if (!globalConfig || activePumpIds.length === 0) return;

    const now = new Date();
    const { time: nowTime } = getDateTime(now);
    
    const slots = globalConfig.timeSlots || [];
    function isInAnyTimeSlot(time) {
        const [nowH, nowM] = time.split(':').map(Number);
        const nowMinutes = nowH * 60 + nowM;

        return slots.some(({ start, end }) => {
            const [startH, startM] = start.split(':').map(Number);
            const [endH, endM] = end.split(':').map(Number);
            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;

            if (startMinutes <= endMinutes) {
                return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
            } else {
                return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
            }
        });
    }

    loadWeather().then(dataWeather => {
        if (dataWeather) {
            const { temp, humidity, weatherMain } = dataWeather;

            const currentTemp = temp;
            const currentHumidity = humidity;
            const currentWeatherMain = weatherMain;

            const setHumidity = globalConfig.humidityThreshold;
            const setTemp = globalConfig.tempThreshold;

            const isRaining = currentWeatherMain === "Rain" || currentWeatherMain === "Drizzle" || currentWeatherMain === "Thunderstorm";
            const highHumidity = currentHumidity >= setHumidity; 
            const isTimeForWatering = isInAnyTimeSlot(nowTime);
            const isGroundDry = currentHumidity < setHumidity; 
            const isHot = currentTemp > setTemp;
            
            const shouldBeOn = isTimeForWatering && isGroundDry && isHot && !isRaining;
            const shouldBeOff = isRaining || highHumidity; 

            activePumpIds.forEach(i => {
                if (pumpModes[i].mode === "auto") {
                    const sw = document.getElementById(`pump0${i}Switch`);
                    const isCurrentlyOn = sw?.checked;
                    
                    if (shouldBeOn && !isCurrentlyOn) {
                        sw.checked = true;
                        togglePump(i);
                    } else if (shouldBeOff && isCurrentlyOn) {
                        sw.checked = false;
                        togglePump(i);
                    } else if (!isTimeForWatering && isCurrentlyOn) {
                        sw.checked = false;
                        togglePump(i);
                    }
                }
            });
        } else {
            console.log("ไม่สามารถดึงข้อมูลสภาพอากาศได้");
        }
    }).catch(error => {
        console.error("เกิดข้อผิดพลาด:", error);
    });
}
// สลับโหมดของปั๊ม (Auto/Manual)
function toggleMode(pumpId) {
  const isAuto = document.getElementById(`modeToggle${pumpId}`).checked;
  const mode = isAuto ? "auto" : "manual";

  db.ref(`pump_0${pumpId}/mode`).set(mode)
    .then(() => {
      console.log(`✅ อัปเดต mode: pump_0${pumpId} = ${mode}`);

      const modeLabelEl = document.getElementById(`modeLabel${pumpId}`);
      if (modeLabelEl) {
          modeLabelEl.textContent = capitalize(mode);
      }
      
      if (mode === "manual") {
        db.ref(`pump_0${pumpId}/status`).once("value")
          .then((snapshot) => {
            const currentStatus = snapshot.val();
            if (currentStatus === "ON") {
              db.ref(`pump_0${pumpId}/status`).set("OFF");
              const sw = document.getElementById(`pump0${pumpId}Switch`);
              const startEl = document.getElementById(`pump0${pumpId}Start`);
              const humEl = document.getElementById(`pump0${pumpId}Humidity`);
              if (sw) sw.checked = false;
              if (startEl) startEl.textContent = "--:--";
              if (humEl) humEl.textContent = "--%"; 
            }
          });
      } 
    })
    .catch((err) => console.error("❌ ล้มเหลว:", err));
}

// =========================================================
// ✅ Utility & CRUD Functions (แปลงปลูก)
// =========================================================

// ฟังก์ชันคำนวณจำนวนวันที่ปลูก
function calculateDaysPlanted(dateString) {
    if (!dateString || dateString === '--/--/--') return '--';
    
    let plantedDate;
    
    if (dateString.includes('-') && dateString.split('-').length === 3) {
        plantedDate = new Date(dateString);
    } else {
        return '--';
    }
    
    const today = new Date();
    
    plantedDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - plantedDate.getTime();
    if (diffTime < 0) return 0; 
    
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
    
    return diffDays; 
}

// ฟังก์ชันสำหรับแสดงข้อมูลสรุปแปลงปลูกในหน้าหลัก
async function renderPlantingHomeSummary() {
    const container = document.getElementById('plantingSummaryContainer');
    if (!container) return; 

    // ดึงข้อมูลแปลงปลูกทั้งหมด (อ้างอิงจาก plots)
    const plotsSnapshot = await db.ref('plots').once('value');
    const plotDetails = plotsSnapshot.val();

    let html = '';
    
    if (!plotDetails || Object.keys(plotDetails).length === 0) {
        html = '<div class="text-Detail" style="padding: 5px 0; text-align: center;">🌱 ยังไม่มีข้อมูลแปลงปลูก กรุณาเพิ่มที่หน้าแปลงปลูก</div>';
    } else {
        const sortedPlotKeys = Object.keys(plotDetails).sort();

        for (const plotRefId of sortedPlotKeys) {
            const plot = plotDetails[plotRefId];
            // ดึง ID ตัวเลขจาก 'plot_0X'
            const plotIdMatch = plotRefId.match(/plot_0(\d+)/);
            const plotId = plotIdMatch ? plotIdMatch[1] : null;

            if (!plotId) continue;
            
            const daysPlanted = calculateDaysPlanted(plot.datePlanted);
            const daysText = daysPlanted !== '--' ? `${daysPlanted} วัน` : '--';

            // Assumption: Plot ID corresponds to Pump ID (e.g., Plot 1 uses Pump 1)
            const pumpId = parseInt(plotId); 
            const pumpData = pumpModes[pumpId];
            
            let waterStatusIcon = '⚪';
            let waterStatusText = 'ไม่พบปั้มเชื่อมโยง';
            let statusClass = 'status-error';

            if (pumpData) {
                const isWatering = pumpData.status === 'ON';
                const lastWateredTime = pumpData.strTime || "--:--";
                
                if (isWatering) {
                    waterStatusIcon = '🚿';
                    waterStatusText = `กำลังรดน้ำ (เริ่ม ${lastWateredTime})`;
                    statusClass = 'status-watering';
                } else if (lastWateredTime !== "--:--") {
                    waterStatusIcon = '✅';
                    waterStatusText = `รดน้ำแล้ว (ล่าสุด ${lastWateredTime})`;
                    statusClass = 'status-normal';
                } else {
                    waterStatusIcon = '💧';
                    waterStatusText = 'ยังไม่ได้รดน้ำ';
                    statusClass = 'status-warning';
                }
            }

            html += `
                <div class="plot-info-summary">
                    <div class="plot-info-header">
                        <span class="crop-name">${plot.cropName || 'ไม่ระบุพืช'}</span>
                        <span class="plot-id">แปลง ${plotId}</span>
                    </div>
                    <div class="plot-row">
                        <span class="text-label">วันเริ่มปลูก: ${plot.datePlanted || '--/--/--'}</span>
                        <span class="text-value">${daysText}</span>
                    </div>
                    <div class="plot-row">
                        <span class="text-label">รดน้ำวันนี้:</span>
                        <span class="text-value ${statusClass}">${waterStatusIcon} ${waterStatusText}</span>
                    </div>
                </div>
            `;
        }
    }

    container.innerHTML = html;
}


// ฟังก์ชันสร้าง Card สำหรับแปลงปลูกแต่ละแปลง (ใช้ใน planting_detail.html)
function renderPlotCard(plotId, data) {
    const plotRefId = `plot_${plotId.toString().padStart(2, '0')}`;
    const datePlanted = data.datePlanted || "--/--/--";
    const plantingMethod = data.plantingMethod || "--"; 
    
    const daysPlanted = calculateDaysPlanted(datePlanted);
    const daysStatus = daysPlanted !== '--' ? `${daysPlanted} วัน` : '--';
    
    const pumpId = parseInt(plotId); 
    const isWatering = pumpModes[pumpId]?.status === "ON";
    const wateringStatusText = isWatering ? '🟢 กำลังรดน้ำ' : '⚫ รดน้ำแล้ว/ปิด'; 
    const wateringStatusClass = isWatering ? 'status-watering' : 'status-normal';

    return `
        <div class="pump-setting" id="${plotRefId}">
            <div class="setting-header" style="padding: 0px;">
                <span class="label">แปลงปลูก ${plotId}: ${data.cropName || 'ไม่ระบุพืช'}</span>
                <div class="plot-actions" style="margin-top: 0px; gap: 4px;"> 
                    <button class="edit-btn" onclick="editPlot('${plotRefId}')">✏️ แก้ไข</button>
                    <button class="delete-btn" onclick="deletePlot('${plotRefId}')">🗑️ ลบ</button>
                </div>
            </div>
            <div class="plot-info" style="margin-top: 5px;"> 
                <div style="border: none; padding-top: 0px;"><strong>พืชที่ปลูก:</strong> ${data.cropName || '--'}</div>
                <div style="border: none;"><strong>วันเริ่มปลูก:</strong> ${datePlanted}</div>
                <div style="border: none;"><strong>ปลูกมาแล้ว:</strong> ${daysStatus}</div>
                <div style="border: none;"><strong>สถานะรดน้ำ (ปั้ม ${pumpId}):</strong> <span class="${wateringStatusClass}">${wateringStatusText}</span></div>
                <div style="border: none;"><strong>วิธีการปลูก:</strong> ${plantingMethod}</div>
                <div style="border: none;"><strong>หมายเหตุ:</strong> ${data.notes || 'ไม่มี'}</div>
            </div>
        </div>
    `;
}

// ฟังก์ชันโหลดข้อมูลแปลงปลูกจาก Firebase
function loadPlantingDetails() {
    const container = document.getElementById("plantingDetailsContainer");
    if (!container) return;
    
    const plotsRef = db.ref('plots'); 
    
    plotsRef.on('value', (snapshot) => {
        const plotsData = snapshot.val() || {};
        let htmlContent = '';
        
        const plotKeys = Object.keys(plotsData).sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)[0]);
            const numB = parseInt(b.match(/\d+/)[0]);
            return numA - numB;
        });

        if (plotKeys.length > 0) {
            plotKeys.forEach(key => {
                const plotIdMatch = key.match(/plot_0(\d+)/);
                const plotId = plotIdMatch ? plotIdMatch[1] : null;

                if (plotId) {
                    if (pumpModes[plotId] === undefined) {
                        db.ref(`pump_0${plotId}`).once("value").then(pumpSnap => {
                             pumpModes[plotId] = pumpSnap.val() || { mode: "manual", status: "OFF" };
                        });
                    }
                    htmlContent += renderPlotCard(plotId, plotsData[key]);
                }
            });
            container.innerHTML = htmlContent;
        } else {
             container.innerHTML = '<p class="no-data">ℹ️ ยังไม่มีข้อมูลแปลงปลูกในระบบ Firebase</p>';
        }
    }, (error) => {
        console.error("❌ Firebase Plot Data Error:", error);
        container.innerHTML = '<p class="error-data">⚠️ เกิดข้อผิดพลาดในการโหลดข้อมูล</p>';
    });
}

function editPlot(plotRefId) {
    const formContainer = document.getElementById('plotFormContainer');
    
    formContainer.style.display = 'flex'; 

    if (plotRefId === 'new') {
        document.getElementById('formPlotId').value = '';
        document.getElementById('formCropName').value = '';
        document.getElementById('formDatePlanted').value = '';
        document.getElementById('formPlantingMethod').value = 'soil'; 
        document.getElementById('formNotes').value = '';
        document.getElementById('formPlotRefId').value = '';
        document.getElementById('formTitle').textContent = 'เพิ่มแปลงปลูกใหม่';
        return;
    }

    db.ref(`plots/${plotRefId}`).once('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            document.getElementById('formTitle').textContent = `แก้ไขแปลงปลูก ${plotRefId}`;
            
            const plotIdMatch = plotRefId.match(/plot_0(\d+)/);
            const plotId = plotIdMatch ? plotIdMatch[1] : '';

            document.getElementById('formPlotId').value = plotId;
            document.getElementById('formCropName').value = data.cropName || '';
            document.getElementById('formDatePlanted').value = data.datePlanted || '';
            document.getElementById('formPlantingMethod').value = data.plantingMethod || 'soil'; 
            document.getElementById('formNotes').value = data.notes || '';
            document.getElementById('formPlotRefId').value = plotRefId; 
        }
    }).catch(error => console.error("❌ Error fetching plot data:", error));
}

function savePlotDetail() {
    const refIdInput = document.getElementById('formPlotRefId').value;
    const plotId = document.getElementById('formPlotId').value.trim();
    const cropName = document.getElementById('formCropName').value.trim();
    const datePlanted = document.getElementById('formDatePlanted').value.trim();
    const plantingMethod = document.getElementById('formPlantingMethod').value; 
    const notes = document.getElementById('formNotes').value.trim();

    if (!plotId || !cropName) {
        alert("กรุณากรอกหมายเลขแปลงและชื่อพืช");
        return;
    }

    const newPlotRefId = `plot_${plotId.padStart(2, '0')}`;
    
    const plotData = {
        cropName,
        datePlanted: datePlanted || '--/--/--',
        plantingMethod: plantingMethod, 
        notes: notes || 'ไม่มี'
    };

    let ref;
    
    if (refIdInput && refIdInput !== newPlotRefId) {
        if(confirm(`คุณต้องการเปลี่ยนหมายเลขแปลงจาก ${refIdInput} เป็น ${newPlotRefId} ใช่หรือไม่? ข้อมูลเก่าจะถูกลบ`)) {
            db.ref(`plots/${refIdInput}`).remove();
            ref = db.ref(`plots/${newPlotRefId}`);
        } else {
            return;
        }
    } else if (refIdInput) {
        ref = db.ref(`plots/${refIdInput}`);
    } else {
        ref = db.ref(`plots/${newPlotRefId}`);
    }


    ref.set(plotData)
        .then(() => {
            alert(`✅ บันทึกแปลงปลูก ${newPlotRefId} สำเร็จ`);
            closePlotForm();
        })
        .catch(error => {
            alert(`❌ บันทึกไม่สำเร็จ: ${error.message}`);
        });
}

function deletePlot(plotRefId) {
    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบแปลงปลูก ${plotRefId} ออกจากระบบ?`)) {
        db.ref(`plots/${plotRefId}`).remove()
            .then(() => {
                alert(`✅ ลบแปลงปลูก ${plotRefId} สำเร็จ`);
            })
            .catch(error => {
                alert(`❌ ลบไม่สำเร็จ: ${error.message}`);
            });
    }
}

function closePlotForm() {
    document.getElementById('plotFormContainer').style.display = 'none';
}


// ✅ Utility Functions 
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

// อัปเดตเวลาล่าสุด
function timeUpdate() {
    const updateEl = document.getElementById("lastUpdate");
    const now = new Date();
    const { thaiDateTime } = getDateTime(now);
    if (updateEl) updateEl.textContent = thaiDateTime;
    
    // อัปเดตข้อมูลแปลงปลูกในหน้าหลักเพื่อให้สถานะรดน้ำอัปเดตแบบเรียลไทม์
    if (document.getElementById("homePage") && document.getElementById("homePage").style.display !== 'none') {
        renderPlantingHomeSummary(); 
    }
}

// ดึงข้อมูลสภาพอากาศจาก OpenWeatherMap API
async function loadWeather() {
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${globalConfig.location.lat}&lon=${globalConfig.location.lon}&units=metric&lang=th&appid=3fe26da4919fb8c89e790fab6d6ab83f`);
    const data = await res.json();

    const temp = data.main.temp.toFixed(1);
    const humidity = data.main.humidity;
    const weatherDescription = data.weather[0].description;
    const weatherMain = data.weather[0].main; 

    document.getElementById("temp").textContent = `🌡️ ${temp}°C`;
    document.getElementById("humidity").textContent = `💧 ${humidity}%`;
    document.getElementById("light").textContent = `🌤️ ${weatherDescription}`;

    return { temp: parseFloat(temp), humidity, weatherMain }; 
  } catch (err) {
    console.error("❌ Weather API Error:", err);
    return null; 
  }
}

// บันทึกการตั้งค่าทั้งหมดลงใน Firebase
function saveGlobalConfig() {
  const tempEl = document.getElementById("tempThreshold");
  const tempThreshold = tempEl ? parseInt(tempEl.value) : 0;
  
  const humidityThreshold = parseInt(document.getElementById("humidityThreshold").value);
  const weatherCondition = document.getElementById("weatherCondition").value;

  const timeSlots = [];
  const rows = document.querySelectorAll("#timeSlotsContainer .time-row");
  
  rows.forEach(row => {
    const start = row.querySelector(".startTime")?.value || "";
    const end = row.querySelector(".endTime")?.value || "";
    timeSlots.push({ start, end });
  });

  const locationInput = document.getElementById("locationInput");
  const [lat, lon] = locationInput.value.split(',').map(Number);
  
  globalConfig.tempThreshold = tempThreshold;
  globalConfig.timeSlots = timeSlots;
  globalConfig.location = { lat, lon };
  globalConfig.humidityThreshold = humidityThreshold;
  globalConfig.weatherCondition = weatherCondition;

  db.ref("globalConfig")
    .set(globalConfig)
    .then(() => console.log("✅ บันทึก globalConfig สำเร็จ"))
    .catch(err => console.error("❌ บันทึกไม่สำเร็จ:", err));

  loadWeather(); 
}

// เพิ่มช่วงเวลาในหน้าตั้งค่า
function addTimeSlot(start = "", end = "") {
  const container = document.getElementById("timeSlotsContainer");

  const slotDiv = document.createElement("div");
  slotDiv.className = "time-row";

  slotDiv.innerHTML = `
    <label>เริ่มเวลา</label>
    <input type="time" class="startTime" value="${start}" />
    <label>สิ้นสุดเวลา</label>
    <input type="time" class="endTime" value="${end}" />
    <button class="delete-btn" onclick="removeTimeSlot(this)">🗑️ ลบ</button>
  `;

  slotDiv.querySelectorAll("input").forEach(input => {
    input.addEventListener("change", saveGlobalConfig);
  });

  container.appendChild(slotDiv);
  saveGlobalConfig();
}

// ลบช่วงเวลา (พร้อมยืนยัน)
function removeTimeSlot(btn) {
  if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบช่วงเวลานี้?")) {
    const slotDiv = btn.parentElement; 
    slotDiv.remove();
    saveGlobalConfig(); 
  }
}

// เริ่มต้นการทำงานทั้งหมดเมื่อหน้าเว็บโหลดเสร็จ
window.onload = async () => {
  await loadDataFromFirebase();
  await loadWeather();
  timeUpdate();
  setInterval(timeUpdate, 3000);
  setInterval(autoControl, 3000);
  
  // เรียกฟังก์ชัน loadPage เพื่อโหลดหน้าแรกและข้อมูล summary เมื่อเริ่มต้น
  if (typeof loadPage === "function") {
    loadPage('home');
  }
};