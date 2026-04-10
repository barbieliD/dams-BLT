import React, { useCallback, useEffect, useMemo, useState } from "react";

const API = {
  coolingData: "/Home/GetCoolingData",
  commonTags: "/Home/GetCommonTags",
  alarmCount: "/Home/AlarmCount",
  equipmentHealth: "/Home/CoolingEquipmentHealth",
  modelAlarmText: "/Home/ModelAlarmText",
  modata: "/Home/Modata",
  openAlertEquip: "/Home/OpenAlertEquip",
};

function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || value === "") return "NA";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "NA";
  return num.toFixed(digits);
}

function Value({ value, unit, onClick, clickable = false }) {
  return (
    <p
      onClick={clickable ? onClick : undefined}
      style={{
        margin: 0,
        background: "gainsboro",
        color: "black",
        padding: "2px 5px",
        fontWeight: "bold",
        fontSize: 17,
        cursor: clickable ? "pointer" : "default",
        userSelect: "none",
        textAlign: "center",
      }}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <span>{value}</span>
      {unit ? <span style={{ marginLeft: 6 }}>{unit}</span> : null}
    </p>
  );
}

function MiniCard({ title, value, unit, onClick }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          background: "#558ed5",
          color: "black",
          fontWeight: "bold",
          textAlign: "center",
          padding: "4px 6px",
          fontSize: 20,
        }}
      >
        {title}
      </div>
      <div style={{ paddingTop: 2 }}>
        <Value value={value} unit={unit} onClick={onClick} clickable />
      </div>
    </div>
  );
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          width: "min(1100px, 100%)",
          background: "white",
          borderRadius: 10,
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontWeight: 700 }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              fontSize: 22,
              cursor: "pointer",
              lineHeight: 1,
            }}
            aria-label="Close"
            type="button"
          >
            ×
          </button>
        </div>
        <div style={{ padding: 14 }}>{children}</div>
      </div>
    </div>
  );
}

export default function CoolingSystem() {
  const topMetrics = useMemo(
    () => [
      { title: "Rotation Angle", tagId: "1084", unit: "°" },
      { title: "Tilting Angle", tagId: "1083", unit: "°" },
      { title: "Gear Box Temp", tagId: "1091", unit: "°C" },
      { title: "Hopper-1 WT", tagId: "1123", unit: "Tons" },
      { title: "Hopper-2 WT", tagId: "1124", unit: "Tons" },
      { title: "Hyd.Pressure", id: "txthydPressure", unit: "" },
      { title: "Hyd. Pump status", id: "txthydpumpstatusCS", unit: "" },
    ],
    [],
  );

  const leftSideMetrics = useMemo(
    () => [
      { title: "Oil Temp. (Planetary – 1)", tagId: "1095", unit: "°C" },
      { title: "Barrier Water Level-1", tagId: "1097", unit: "mm" },
      { title: "Barrier Water Level-2", tagId: "1098", unit: "mm" },
      { title: "GB Casing Temp.-1", tagId: "1091", unit: "°C" },
      { title: "GB Casing Temp.-2", tagId: "1092", unit: "°C" },
      { title: "Make up Flow", tagId: "1172", unit: "m³" },
      { title: "Water barrier make up time", tagId: "1645", unit: "hrs" },
      { title: "Water barrier make up vol.", tagId: "1646", unit: "m³" },
    ],
    [],
  );

  const rightSideMetrics = useMemo(
    () => [
      { title: "Oil Temp. (Planetary – 2)", tagId: "1096", unit: "°C" },
      { title: "Barrier Water Level-3", tagId: "1099", unit: "mm" },
      { title: "Barrier Water Level-4", tagId: "1100", unit: "mm" },
      { title: "GB Casing Temp.-3", tagId: "1093", unit: "°C" },
      { title: "GB Casing Temp.-4", tagId: "1094", unit: "°C" },
      { title: "Labyrinth make up time", tagId: "1647", unit: "hrs" },
      { title: "Labyrinth make up vol.", tagId: "1648", unit: "m³" },
    ],
    [],
  );

  const [latestByTag, setLatestByTag] = useState({});
  const [avgByTag, setAvgByTag] = useState({});
  const [hydPressure, setHydPressure] = useState("NA");
  const [pumpStatus, setPumpStatus] = useState("PUMP-1");
  const [alarmCounts, setAlarmCounts] = useState({
    TOTAL: "NA",
    OPEN: "NA",
    CLOSE: "NA",
    ACK: "NA",
  });
  const [recentAlarms, setRecentAlarms] = useState({ first: "", second: "" });
  const [equipmentHealthText, setEquipmentHealthText] = useState("");
  const [selectedTagForTrend, setSelectedTagForTrend] = useState(null);
  const [selectedCompliance, setSelectedCompliance] = useState(null);

  const postJson = useCallback(async (url, body) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: body ? JSON.stringify(body) : null,
    });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return await res.json();
  }, []);

  const showTrend = useCallback((tagId) => setSelectedTagForTrend(tagId), []);

  const fetchCoolingData = useCallback(async () => {
    try {
      const data = await postJson(API.coolingData);
      if (!Array.isArray(data)) return;
      setLatestByTag((prev) => {
        const next = { ...prev };
        for (const row of data) {
          if (row?.Tag_Id === undefined || row?.Tag_Id === null) continue;
          next[String(row.Tag_Id)] = formatNumber(row.Tag_Value, 1);
        }
        return next;
      });
      setAvgByTag((prev) => {
        const next = { ...prev };
        for (const row of data) {
          if (row?.Tag_Id === undefined || row?.Tag_Id === null) continue;
          next[String(row.Tag_Id)] = formatNumber(row.Tag_Avg_Value, 1);
        }
        return next;
      });
    } catch {
      // noop
    }
  }, [postJson]);

  const fetchCommonCoolingData = useCallback(async () => {
    try {
      const data = await postJson(API.commonTags);
      setHydPressure(`${formatNumber(data?.IdPlcSeq_2426_Value, 1)} bar`);
      setPumpStatus(String(data?.PumpStatus ?? "NA"));

      for (const id of ["1645", "1646", "1647", "1648"]) {
        const key = `IdPlcSeq_${id}_Value`;
        const v = data?.[key];
        if (v !== undefined && v !== null) {
          setLatestByTag((prev) => ({ ...prev, [id]: formatNumber(v, 1) }));
        }
      }
    } catch {
      // noop
    }
  }, [postJson]);

  const fetchAlarmCount = useCallback(async () => {
    try {
      const data = await postJson(API.alarmCount, { EQUIP_ID: "COOLING" });
      setAlarmCounts({
        TOTAL: String(data?.TOTAL ?? "NA"),
        OPEN: String(data?.OPEN ?? "NA"),
        CLOSE: String(data?.CLOSE ?? "NA"),
        ACK: String(data?.ACK ?? "NA"),
      });
    } catch {
      // noop
    }
  }, [postJson]);

  const fetchAlarmText = useCallback(async () => {
    try {
      const data = await postJson(API.modelAlarmText, { EQUIP_ID: "COOLING" });
      if (!Array.isArray(data) || data.length === 0) return;
      setRecentAlarms({
        first: String(data?.[0]?.AlarmText ?? ""),
        second: String(data?.[1]?.AlarmText ?? ""),
      });
    } catch {
      // noop
    }
  }, [postJson]);

  const fetchEquipmentHealth = useCallback(async () => {
    try {
      const data = await postJson(API.equipmentHealth, { EQUIP_ID: "COOLING" });
      const motor = Number(data?.CoolingSystemMotor_Value);
      const instr = Number(data?.CoolingSystemInstr_Value);
      const swg = Number(data?.SWITCHGEAR_Value);
      const vals = [motor, instr, swg].filter((n) => Number.isFinite(n));
      if (vals.length) {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        setEquipmentHealthText(`Equipment Health : ${avg.toFixed(2)} %`);
      } else {
        setEquipmentHealthText("");
      }
    } catch {
      // noop
    }
  }, [postJson]);

  useEffect(() => {
    fetchCoolingData();
    fetchCommonCoolingData();
    fetchAlarmCount();
    fetchEquipmentHealth();
    fetchAlarmText();

    const interval = window.setInterval(() => {
      fetchCoolingData();
    }, 300000);

    return () => window.clearInterval(interval);
  }, [
    fetchAlarmCount,
    fetchAlarmText,
    fetchCommonCoolingData,
    fetchCoolingData,
    fetchEquipmentHealth,
  ]);

  return (
    <div style={{ backgroundColor: "black", minHeight: "110vh", color: "white" }}>
      <div
        style={{
          background: "rgba(220,220,220,255)",
          color: "black",
          fontSize: 23,
          fontWeight: "bold",
          margin: "0 -9px",
          textAlign: "center",
          padding: "6px 0",
        }}
      >
        COOLING SYSTEM
      </div>

      <div id="divCoolSystem" style={{ padding: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          {topMetrics.map((m) => (
            <MiniCard
              key={m.tagId ?? m.id}
              title={m.title}
              value={
                m.id === "txthydPressure"
                  ? hydPressure
                  : m.id === "txthydpumpstatusCS"
                    ? pumpStatus
                    : latestByTag[m.tagId] ?? "NA"
              }
              unit={m.tagId ? m.unit : ""}
              onClick={m.tagId ? () => showTrend(m.tagId) : undefined}
            />
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr 2fr 3fr", gap: 10, marginTop: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {leftSideMetrics.map((m) => (
              <div key={m.tagId}>
                <div style={{ background: "#558ed5", color: "black", fontWeight: "bold", textAlign: "center" }}>
                  {m.title}
                </div>
                <div style={{ marginTop: 2 }}>
                  <Value
                    value={latestByTag[m.tagId] ?? "NA"}
                    unit={m.unit}
                    onClick={() => showTrend(m.tagId)}
                    clickable
                  />
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "transparent",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: 6,
            }}
          >
            <div
              style={{
                width: "100%",
                height: "75vh",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.75)",
                fontWeight: 600,
              }}
            >
              CoolingSystem image not in repo
              <br />
              (place it at `public/images/CoolingSystem.png`)
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {rightSideMetrics.map((m) => (
              <div key={m.tagId}>
                <div style={{ background: "#558ed5", color: "black", fontWeight: "bold", textAlign: "center" }}>
                  {m.title}
                </div>
                <div style={{ marginTop: 2 }}>
                  <Value
                    value={latestByTag[m.tagId] ?? "NA"}
                    unit={m.unit}
                    onClick={() => showTrend(m.tagId)}
                    clickable
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ border: "2px solid black", borderBottom: "none" }}>
              <div
                style={{
                  background: "#558ed5",
                  color: "black",
                  fontWeight: "bold",
                  textAlign: "center",
                  padding: "6px 8px",
                }}
              >
                <div id="txtCoolingPer">{equipmentHealthText}</div>
              </div>
            </div>

            <div style={{ border: "2px solid black" }}>
              <div style={{ display: "flex", gap: 6, padding: 6 }}>
                {[
                  { title: "COOLING SYSTEM MOTOR", key: "COOLINGSYSTEMMOTOR" },
                  { title: "COOLING SYSTEM INSTR", key: "COOLSYSTEMINSTR" },
                  { title: "SWITCH GEAR", key: "SWITCHGEAR" },
                ].map((x) => (
                  <div key={x.key} style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: "bold",
                        textAlign: "center",
                        backgroundColor: "#558ed5",
                        color: "black",
                        padding: "4px 6px",
                      }}
                    >
                      {x.title}
                    </div>
                    <div
                      id={
                        x.key === "COOLINGSYSTEMMOTOR"
                          ? "COOLINGSYSTEMMOTORchart-container1"
                          : x.key === "COOLSYSTEMINSTR"
                            ? "COOLSYSTEMINSTRchart-container2"
                            : "COOLSYSTEMINSTRchart-container3"
                      }
                      style={{
                        height: 80,
                        background: "rgba(255,255,255,0.06)",
                        borderRadius: 6,
                        marginTop: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                      onClick={() => setSelectedCompliance(x.title)}
                      role="button"
                      tabIndex={0}
                    >
                      Gauge placeholder
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: "2px solid black" }}>
              <div style={{ padding: 8 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 700 }}>Recent Alarm</div>
                  <button
                    type="button"
                    onClick={() => setSelectedCompliance("Alarm Details")}
                    style={{ background: "transparent", border: "none", color: "deepskyblue", cursor: "pointer" }}
                  >
                    View details
                  </button>
                </div>
                <div id="txtCoolingFirstLine" style={{ marginTop: 6, color: "white" }}>
                  {recentAlarms.first}
                </div>
                <div id="txtCoolingSecondLine" style={{ marginTop: 6, color: "white" }}>
                  {recentAlarms.second}
                </div>
              </div>
            </div>

            <div style={{ border: "2px solid black" }}>
              <div style={{ display: "flex" }}>
                <div style={{ flex: 1, padding: 10, background: "#16a34a" }}>
                  <div style={{ fontWeight: 700, color: "black" }}>
                    <span id="txtCoolingTotalAlaert">{alarmCounts.TOTAL}</span> Total Alerts
                  </div>
                </div>
                <div style={{ flex: 1, padding: 10, background: "#0ea5e9" }}>
                  <div style={{ fontWeight: 700, color: "black" }}>
                    <span id="txtCoolingOpen">{alarmCounts.OPEN}</span> Open Alerts
                  </div>
                </div>
                <div style={{ flex: 1, padding: 10, background: "#f59e0b" }}>
                  <div style={{ fontWeight: 700, color: "black" }}>
                    <span id="txtCoolingClosed">{alarmCounts.CLOSE}</span> Closed Alert
                  </div>
                </div>
                <div style={{ flex: 1, padding: 10, background: "white" }}>
                  <div style={{ fontWeight: 700, color: "black" }}>
                    <span id="txtCoolingTotalAck">{alarmCounts.ACK}</span> Ack Alert
                  </div>
                </div>
              </div>
            </div>

            <div style={{ border: "2px solid black" }}>
              <div id="Cooling-container" style={{ height: 130, display: "flex", alignItems: "center", justifyContent: "center" }}>
                Alerts bar chart placeholder
              </div>
            </div>

            <div style={{ border: "2px solid black", borderBottom: "none" }}>
              <div
                style={{
                  background: "#558ed5",
                  color: "black",
                  fontWeight: "bold",
                  textAlign: "center",
                  padding: "8px 10px",
                }}
              >
                SAP PM MO Compliance
              </div>
            </div>
            <div style={{ border: "2px solid black" }}>
              <div id="sap-pmo" style={{ height: 130, display: "flex", alignItems: "center", justifyContent: "center" }}>
                Compliance chart placeholder
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={selectedTagForTrend !== null}
        title="Digital Asset Management System"
        onClose={() => setSelectedTagForTrend(null)}
      >
        <div style={{ fontWeight: 700, marginBottom: 10 }}>
          Trend for Tag ID: {selectedTagForTrend}
        </div>
        <div
          id="trendGraph"
          style={{
            height: 480,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#111827",
          }}
        >
          Trend graph integration placeholder
        </div>
      </Modal>

      <Modal open={selectedCompliance !== null} title={`Equipment Health (${selectedCompliance ?? ""})`} onClose={() => setSelectedCompliance(null)}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div>
            <b>Alert Comp. :</b> <span id="AlertComp">—</span>
          </div>
          <div>
            <b>MO Comp. :</b> <span id="MoComp">—</span>
          </div>
          <div>
            <b>NO Comp. :</b> <span id="NoComp">—</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}