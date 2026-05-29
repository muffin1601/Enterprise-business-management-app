import { useState, useRef, useCallback } from "react";

// ─── Seed Data ───────────────────────────────────────────────────────────────
const SEED_ITEMS = [
  {
    id: "ITM-001", name: "Porcelain Floor Tile 600x600", unit: "SQM",
    purchasePrice: 420, sellingPrice: 680, stock: 1240, deliveryDays: 21,
    brand: "Kajaria", isImported: false, image: null,
    variations: [{ size: "600x600", finish: "Matte", make: "Standard" }],
    history: [
      { date: "2026-05-10", qty: 400, customer: "Rahul Constructions", value: 272000 },
      { date: "2026-04-22", qty: 250, customer: "GreenBuild Pvt Ltd", value: 170000 },
      { date: "2026-04-01", qty: 590, customer: "Metro Interiors", value: 401200 },
      { date: "2026-03-15", qty: 180, customer: "Rahul Constructions", value: 122400 },
    ],
    lastPurchase: { date: "2026-05-01", price: 420, supplier: "Kajaria Direct" }
  },
  {
    id: "ITM-002", name: "Italian Marble Slab 2400x1200", unit: "SQM",
    purchasePrice: 3800, sellingPrice: 6200, stock: 88, deliveryDays: 45,
    brand: "Carrara Imports", isImported: true, image: null,
    importCurrency: "EUR", importPrice: 42, exchangeRate: 89.5,
    discount: 5, transport: 8, transportType: "percent",
    customDuty: 18, profitMultiplier: 1.35,
    variations: [{ size: "2400x1200", finish: "Polished", make: "Premium" }],
    history: [
      { date: "2026-05-12", qty: 18, customer: "Elite Residences", value: 111600 },
      { date: "2026-04-28", qty: 22, customer: "The Arch Studio", value: 136400 },
      { date: "2026-03-30", qty: 30, customer: "Peninsula Hotels", value: 186000 },
    ],
    lastPurchase: { date: "2026-04-20", price: 3800, supplier: "Carrara Imports Mumbai" }
  },
  {
    id: "ITM-003", name: "Vitrified Tile 800x800", unit: "SQM",
    purchasePrice: 580, sellingPrice: 920, stock: 620, deliveryDays: 14,
    brand: "Somany", isImported: false, image: null,
    variations: [{ size: "800x800", finish: "GVT", make: "Glossy" }],
    history: [
      { date: "2026-05-08", qty: 200, customer: "Skyline Developers", value: 184000 },
      { date: "2026-04-15", qty: 180, customer: "Rahul Constructions", value: 165600 },
    ],
    lastPurchase: { date: "2026-04-10", price: 580, supplier: "Somany Ceramics" }
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
const fmtCur = (n) => "₹ " + fmt(n);
const today = new Date().toISOString().split("T")[0];
const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];

// ─── Shared styles ────────────────────────────────────────────────────────────
const S = {
  page: { fontFamily: "'Zen Kaku Gothic New', 'Noto Sans JP', sans-serif", background: "#f8f7f4", minHeight: "100vh", color: "#0a0a0a" },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderBottom: "1px solid rgba(10,10,10,0.1)", background: "#fff" },
  brand: { fontFamily: "'Noto Serif JP', serif", fontWeight: 300, fontSize: 16, letterSpacing: "0.2em" },
  body: { display: "flex", minHeight: "calc(100vh - 49px)" },
  sidebar: { width: 220, borderRight: "1px solid rgba(10,10,10,0.08)", background: "#fff", flexShrink: 0, padding: "16px 0" },
  main: { flex: 1, padding: "24px", overflow: "auto" },
  sectionLabel: { fontSize: 8, letterSpacing: "0.45em", textTransform: "uppercase", color: "#999", padding: "0 18px", marginBottom: 6 },
  navItem: (active) => ({ display: "flex", alignItems: "center", gap: 9, padding: "8px 18px", fontSize: 11, letterSpacing: "0.06em", color: active ? "#0a0a0a" : "#555", background: active ? "#f8f7f4" : "transparent", borderLeft: `2px solid ${active ? "#0a0a0a" : "transparent"}`, cursor: "pointer", fontWeight: active ? 500 : 400 }),
  panel: { background: "#fff", border: "1px solid rgba(10,10,10,0.1)", padding: "18px" },
  panelTitle: { fontSize: 9, letterSpacing: "0.4em", textTransform: "uppercase", color: "#888", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid rgba(10,10,10,0.07)" },
  label: { fontSize: 9, letterSpacing: "0.35em", textTransform: "uppercase", color: "#888", display: "block", marginBottom: 5 },
  input: { width: "100%", background: "transparent", border: "none", borderBottom: "1px solid rgba(10,10,10,0.25)", padding: "7px 0", fontSize: 13, fontFamily: "inherit", color: "#0a0a0a", outline: "none", letterSpacing: "0.03em" },
  select: { width: "100%", background: "#fff", border: "1px solid rgba(10,10,10,0.18)", padding: "7px 8px", fontSize: 12, fontFamily: "inherit", color: "#0a0a0a", outline: "none" },
  btnPrimary: { background: "#0a0a0a", color: "#f8f7f4", border: "none", padding: "9px 20px", fontSize: 10, letterSpacing: "0.4em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" },
  btnGhost: { background: "transparent", color: "#555", border: "1px solid rgba(10,10,10,0.2)", padding: "7px 16px", fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" },
  tag: { display: "inline-block", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", padding: "2px 8px", background: "#0a0a0a", color: "#f8f7f4" },
  tagGhost: { display: "inline-block", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", padding: "2px 8px", border: "1px solid rgba(10,10,10,0.2)", color: "#555" },
  fieldRow: { marginBottom: 16 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 },
  grid4: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 },
};

// ─── Item Card ────────────────────────────────────────────────────────────────
function ItemCard({ item, onClick }) {
  const stockPct = Math.min(100, Math.round((item.stock / 2000) * 100));
  return (
    <div onClick={() => onClick(item)} style={{ background: "#fff", border: "1px solid rgba(10,10,10,0.1)", padding: "16px", cursor: "pointer", transition: "border-color 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "#0a0a0a"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(10,10,10,0.1)"}>
      <div style={{ height: 80, background: "#f3f2ef", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, overflow: "hidden" }}>
        {item.image ? <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 9, letterSpacing: "0.3em", color: "#bbb", textTransform: "uppercase" }}>No Image</span>}
      </div>
      <div style={{ fontSize: 9, letterSpacing: "0.3em", color: "#999", marginBottom: 4, textTransform: "uppercase" }}>{item.id}</div>
      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, lineHeight: 1.3 }}>{item.name}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 15, fontWeight: 300 }}>{fmtCur(item.sellingPrice)}</span>
        <span style={{ fontSize: 9, color: "#999", letterSpacing: "0.1em" }}>per {item.unit}</span>
      </div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 9, color: "#aaa", letterSpacing: "0.2em", textTransform: "uppercase" }}>Stock</span>
          <span style={{ fontSize: 10, fontWeight: 500 }}>{fmt(item.stock)} {item.unit}</span>
        </div>
        <div style={{ height: 2, background: "#e8e6e0" }}>
          <div style={{ width: `${stockPct}%`, height: "100%", background: item.stock < 100 ? "#8a3030" : "#0a0a0a" }} />
        </div>
      </div>
      {item.isImported && <span style={S.tag}>Imported</span>}
    </div>
  );
}

// ─── Item Detail ──────────────────────────────────────────────────────────────
function ItemDetail({ item, onBack }) {
  const [dateFrom, setDateFrom] = useState(ninetyDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const filtered = item.history.filter(h => h.date >= dateFrom && h.date <= dateTo);
  const totalQty = filtered.reduce((s, h) => s + h.qty, 0);
  const totalVal = filtered.reduce((s, h) => s + h.value, 0);
  const customers = [...new Set(filtered.map(h => h.customer))];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={S.btnGhost}>← Back</button>
        <span style={{ fontSize: 9, letterSpacing: "0.4em", color: "#aaa", textTransform: "uppercase" }}>Item Detail</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 18, marginBottom: 18 }}>
        <div>
          <div style={{ height: 200, background: "#f3f2ef", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(10,10,10,0.08)", marginBottom: 12 }}>
            {item.image ? <img src={item.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 9, letterSpacing: "0.3em", color: "#ccc", textTransform: "uppercase" }}>No Image</span>}
          </div>
          <div style={S.panel}>
            <div style={S.panelTitle}>Last Purchase</div>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 6 }}>{item.lastPurchase.supplier}</div>
            <div style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 22, fontWeight: 300, marginBottom: 4 }}>{fmtCur(item.lastPurchase.price)}</div>
            <div style={{ fontSize: 10, color: "#aaa" }}>per {item.unit} · {item.lastPurchase.date}</div>
          </div>
        </div>

        <div>
          <div style={{ marginBottom: 4, fontFamily: "'Noto Serif JP', serif", fontSize: 22, fontWeight: 300 }}>{item.name}</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#888" }}>{item.id}</span>
            <span style={item.isImported ? S.tag : S.tagGhost}>{item.isImported ? "Imported" : "Domestic"}</span>
            {item.brand && <span style={S.tagGhost}>{item.brand}</span>}
          </div>

          <div style={{ ...S.grid4, marginBottom: 16 }}>
            {[
              { l: "Current Stock", v: fmt(item.stock) + " " + item.unit },
              { l: "Selling Price", v: fmtCur(item.sellingPrice) + "/" + item.unit },
              { l: "Purchase Price", v: fmtCur(item.purchasePrice) + "/" + item.unit },
              { l: "Delivery Time", v: item.deliveryDays + " days" },
            ].map(({ l, v }) => (
              <div key={l} style={{ background: "#f8f7f4", padding: "12px 14px", border: "1px solid rgba(10,10,10,0.07)" }}>
                <div style={{ fontSize: 8, letterSpacing: "0.4em", textTransform: "uppercase", color: "#aaa", marginBottom: 6 }}>{l}</div>
                <div style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 16, fontWeight: 300, color: "#0a0a0a" }}>{v}</div>
              </div>
            ))}
          </div>

          {item.variations?.length > 0 && (
            <div style={S.panel}>
              <div style={S.panelTitle}>Variations</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {item.variations.map((v, i) => (
                  <div key={i} style={{ border: "1px solid rgba(10,10,10,0.12)", padding: "6px 12px", fontSize: 11, color: "#555" }}>
                    {[v.size, v.finish, v.make, v.brand].filter(Boolean).join(" · ")}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={S.panel}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid rgba(10,10,10,0.07)" }}>
          <span style={{ fontSize: 9, letterSpacing: "0.4em", textTransform: "uppercase", color: "#888" }}>Stock Movement Report</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ fontSize: 10, color: "#aaa", marginRight: 4 }}>From</div>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...S.input, width: 130, fontSize: 11 }} />
            <div style={{ fontSize: 10, color: "#aaa" }}>To</div>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ ...S.input, width: 130, fontSize: 11 }} />
          </div>
        </div>

        <div style={{ ...S.grid3, marginBottom: 16 }}>
          {[
            { l: "Total Qty Sold", v: fmt(totalQty) + " " + item.unit },
            { l: "Total Revenue", v: fmtCur(totalVal) },
            { l: "Unique Customers", v: customers.length },
          ].map(({ l, v }) => (
            <div key={l} style={{ background: "#f8f7f4", padding: "10px 14px" }}>
              <div style={{ fontSize: 8, letterSpacing: "0.4em", textTransform: "uppercase", color: "#aaa", marginBottom: 5 }}>{l}</div>
              <div style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 18, fontWeight: 300 }}>{v}</div>
            </div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", fontSize: 11, color: "#bbb", letterSpacing: "0.2em" }}>No transactions in selected period</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(10,10,10,0.1)" }}>
                {["Date", "Customer", "Quantity", "Value"].map(h => (
                  <th key={h} style={{ textAlign: h === "Quantity" || h === "Value" ? "right" : "left", padding: "8px 0", fontSize: 9, letterSpacing: "0.3em", textTransform: "uppercase", color: "#aaa", fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((h, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(10,10,10,0.05)" }}>
                  <td style={{ padding: "9px 0", color: "#888" }}>{h.date}</td>
                  <td style={{ padding: "9px 0" }}>{h.customer}</td>
                  <td style={{ padding: "9px 0", textAlign: "right" }}>{fmt(h.qty)} {item.unit}</td>
                  <td style={{ padding: "9px 0", textAlign: "right", fontFamily: "'Noto Serif JP', serif", fontWeight: 300 }}>{fmtCur(h.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Price Calculator ─────────────────────────────────────────────────────────
function PriceCalc({ form, setForm }) {
  const { importCurrency = "USD", importPrice = 0, exchangeRate = 83, discount = 0, transportType = "lumpsum", transport = 0, customDuty = 0, profitMultiplier = 1.3 } = form;

  const baseINR = parseFloat(importPrice || 0) * parseFloat(exchangeRate || 1);
  const afterDiscount = baseINR * (1 - parseFloat(discount || 0) / 100);
  const transportCost = transportType === "lumpsum" ? parseFloat(transport || 0) : afterDiscount * parseFloat(transport || 0) / 100;
  const withTransport = afterDiscount + transportCost;
  const withDuty = withTransport * (1 + parseFloat(customDuty || 0) / 100);
  const finalSell = withDuty * parseFloat(profitMultiplier || 1);

  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ ...S.panel, marginTop: 16, borderLeft: "3px solid #0a0a0a" }}>
      <div style={S.panelTitle}>Import Price Calculator</div>
      <div style={S.grid3}>
        <div style={S.fieldRow}>
          <label style={S.label}>Currency</label>
          <select style={S.select} value={importCurrency} onChange={e => up("importCurrency", e.target.value)}>
            <option>USD</option><option>EUR</option><option>CNY</option>
          </select>
        </div>
        <div style={S.fieldRow}>
          <label style={S.label}>Price in {importCurrency}</label>
          <input style={S.input} type="number" value={importPrice} onChange={e => up("importPrice", e.target.value)} placeholder="0.00" />
        </div>
        <div style={S.fieldRow}>
          <label style={S.label}>Exchange Rate (₹ per {importCurrency})</label>
          <input style={S.input} type="number" value={exchangeRate} onChange={e => up("exchangeRate", e.target.value)} placeholder="83" />
        </div>
        <div style={S.fieldRow}>
          <label style={S.label}>Discount %</label>
          <input style={S.input} type="number" value={discount} onChange={e => up("discount", e.target.value)} placeholder="0" />
        </div>
        <div style={S.fieldRow}>
          <label style={S.label}>Transport Mode</label>
          <select style={S.select} value={transportType} onChange={e => up("transportType", e.target.value)}>
            <option value="lumpsum">Lump Sum (₹)</option>
            <option value="percent">% of Cost After Discount</option>
          </select>
        </div>
        <div style={S.fieldRow}>
          <label style={S.label}>Transport {transportType === "lumpsum" ? "(₹)" : "(%)"}</label>
          <input style={S.input} type="number" value={transport} onChange={e => up("transport", e.target.value)} placeholder="0" />
        </div>
        <div style={S.fieldRow}>
          <label style={S.label}>Custom Duty %</label>
          <input style={S.input} type="number" value={customDuty} onChange={e => up("customDuty", e.target.value)} placeholder="0" />
        </div>
        <div style={S.fieldRow}>
          <label style={S.label}>Profit Multiplier</label>
          <input style={S.input} type="number" value={profitMultiplier} onChange={e => up("profitMultiplier", e.target.value)} step="0.01" placeholder="1.30" />
        </div>
        <div style={{ ...S.panel, background: "#f8f7f4", border: "none", padding: "12px 14px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 8, letterSpacing: "0.4em", textTransform: "uppercase", color: "#aaa", marginBottom: 6 }}>Calculated Selling Price</div>
          <div style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 22, fontWeight: 300, color: "#0a0a0a" }}>{fmtCur(Math.round(finalSell))}</div>
          <div style={{ fontSize: 9, color: "#aaa", marginTop: 4 }}>per {form.unit || "unit"}</div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(10,10,10,0.07)", paddingTop: 12, marginTop: 4 }}>
        <div style={{ display: "flex", gap: 20, fontSize: 10, color: "#888", flexWrap: "wrap" }}>
          {[
            ["Base INR", fmtCur(Math.round(baseINR))],
            ["After Discount", fmtCur(Math.round(afterDiscount))],
            ["+ Transport", fmtCur(Math.round(transportCost))],
            ["+ Duty", fmtCur(Math.round(withDuty - withTransport))],
            ["Cost Price", fmtCur(Math.round(withDuty))],
            ["Selling Price", fmtCur(Math.round(finalSell))],
          ].map(([l, v]) => (
            <div key={l}>
              <span style={{ letterSpacing: "0.2em", textTransform: "uppercase", fontSize: 8, color: "#bbb" }}>{l}</span>
              <span style={{ marginLeft: 8, fontFamily: "'Noto Serif JP', serif", fontWeight: 300, color: "#0a0a0a" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── New Item Form ────────────────────────────────────────────────────────────
function NewItemForm({ onSave, onCancel }) {
  const [form, setForm] = useState({
    name: "", unit: "SQM", brand: "", deliveryDays: 14,
    purchasePrice: 0, sellingPrice: 0, stock: 0,
    isImported: false, image: null,
    variations: [],
    importCurrency: "USD", importPrice: 0, exchangeRate: 83,
    discount: 0, transportType: "lumpsum", transport: 0,
    customDuty: 0, profitMultiplier: 1.3,
  });
  const [newVar, setNewVar] = useState({ size: "", finish: "", make: "", brand: "" });
  const fileRef = useRef();
  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addVariation = () => {
    if (!newVar.size && !newVar.finish && !newVar.make) return;
    setForm(f => ({ ...f, variations: [...f.variations, { ...newVar }] }));
    setNewVar({ size: "", finish: "", make: "", brand: "" });
  };

  const removeVar = (i) => setForm(f => ({ ...f, variations: f.variations.filter((_, j) => j !== i) }));

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => up("image", ev.target.result);
    reader.readAsDataURL(file);
  };

  const calcSellPrice = () => {
    if (!form.isImported) return;
    const baseINR = parseFloat(form.importPrice || 0) * parseFloat(form.exchangeRate || 1);
    const afterDiscount = baseINR * (1 - parseFloat(form.discount || 0) / 100);
    const transportCost = form.transportType === "lumpsum" ? parseFloat(form.transport || 0) : afterDiscount * parseFloat(form.transport || 0) / 100;
    const withTransport = afterDiscount + transportCost;
    const withDuty = withTransport * (1 + parseFloat(form.customDuty || 0) / 100);
    const sell = withDuty * parseFloat(form.profitMultiplier || 1);
    up("sellingPrice", Math.round(sell));
    up("purchasePrice", Math.round(withDuty));
  };

  const handleSave = () => {
    if (!form.name.trim()) return alert("Please enter item name");
    if (form.isImported) calcSellPrice();
    onSave({
      ...form,
      id: "ITM-" + String(Math.floor(Math.random() * 900) + 100).padStart(3, "0"),
      history: [],
      lastPurchase: { date: today, price: form.purchasePrice, supplier: "—" },
    });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={onCancel} style={S.btnGhost}>← Cancel</button>
        <span style={{ fontSize: 9, letterSpacing: "0.4em", color: "#aaa", textTransform: "uppercase" }}>New Item</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 18 }}>
        <div>
          <div
            style={{ height: 180, background: "#f3f2ef", border: "1px solid rgba(10,10,10,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 10 }}
            onClick={() => fileRef.current.click()}>
            {form.image ? <img src={form.image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, letterSpacing: "0.3em", color: "#bbb", textTransform: "uppercase" }}>Click to Upload</div>
                <div style={{ fontSize: 9, color: "#ccc", marginTop: 4 }}>Product Image</div>
              </div>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} style={{ display: "none" }} />
          <div style={S.fieldRow}>
            <label style={{ ...S.label, marginBottom: 8 }}>Item Type</label>
            <div style={{ display: "flex", border: "1px solid rgba(10,10,10,0.2)" }}>
              {["Domestic", "Imported"].map(t => (
                <button key={t} onClick={() => up("isImported", t === "Imported")}
                  style={{ flex: 1, padding: "7px 0", fontSize: 10, letterSpacing: "0.2em", background: (t === "Imported") === form.isImported ? "#0a0a0a" : "transparent", color: (t === "Imported") === form.isImported ? "#f8f7f4" : "#888", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div style={S.panel}>
            <div style={S.panelTitle}>Basic Information</div>
            <div style={S.grid2}>
              <div style={{ ...S.fieldRow, gridColumn: "1/-1" }}>
                <label style={S.label}>Item Name</label>
                <input style={S.input} value={form.name} onChange={e => up("name", e.target.value)} placeholder="Enter full item name" />
              </div>
              <div style={S.fieldRow}>
                <label style={S.label}>Brand</label>
                <input style={S.input} value={form.brand} onChange={e => up("brand", e.target.value)} placeholder="Brand name" />
              </div>
              <div style={S.fieldRow}>
                <label style={S.label}>Unit</label>
                <select style={S.select} value={form.unit} onChange={e => up("unit", e.target.value)}>
                  {["SQM", "SQF", "PCS", "BOX", "KG", "MTR", "LTR", "SET", "NOS"].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div style={S.fieldRow}>
                <label style={S.label}>Approx. Delivery (days)</label>
                <input style={S.input} type="number" value={form.deliveryDays} onChange={e => up("deliveryDays", e.target.value)} />
              </div>
              <div style={S.fieldRow}>
                <label style={S.label}>Opening Stock</label>
                <input style={S.input} type="number" value={form.stock} onChange={e => up("stock", e.target.value)} placeholder="0" />
              </div>
            </div>

            {!form.isImported && (
              <div style={{ ...S.grid2, marginTop: 8 }}>
                <div style={S.fieldRow}>
                  <label style={S.label}>Purchase Price (₹) per {form.unit}</label>
                  <input style={S.input} type="number" value={form.purchasePrice} onChange={e => up("purchasePrice", e.target.value)} placeholder="0.00" />
                </div>
                <div style={S.fieldRow}>
                  <label style={S.label}>Selling Price (₹) per {form.unit}</label>
                  <input style={S.input} type="number" value={form.sellingPrice} onChange={e => up("sellingPrice", e.target.value)} placeholder="0.00" />
                </div>
              </div>
            )}
          </div>

          {form.isImported && <PriceCalc form={form} setForm={setForm} />}

          <div style={{ ...S.panel, marginTop: 16 }}>
            <div style={S.panelTitle}>Variations (Size / Make / Finish / Brand)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 36px", gap: 10, marginBottom: 10 }}>
              {["size", "finish", "make", "brand"].map(k => (
                <input key={k} style={S.input} placeholder={k.charAt(0).toUpperCase() + k.slice(1)} value={newVar[k]} onChange={e => setNewVar(v => ({ ...v, [k]: e.target.value }))} />
              ))}
              <button onClick={addVariation} style={{ ...S.btnPrimary, padding: "0", fontSize: 18 }}>+</button>
            </div>
            {form.variations.length === 0 ? (
              <div style={{ fontSize: 10, color: "#ccc", letterSpacing: "0.2em" }}>No variations added yet</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {form.variations.map((v, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid rgba(10,10,10,0.15)", padding: "4px 10px", fontSize: 11 }}>
                    <span>{[v.size, v.finish, v.make, v.brand].filter(Boolean).join(" · ")}</span>
                    <button onClick={() => removeVar(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
        <button onClick={onCancel} style={S.btnGhost}>Cancel</button>
        {form.isImported && <button onClick={calcSellPrice} style={S.btnGhost}>Recalculate Price</button>}
        <button onClick={handleSave} style={S.btnPrimary}>Save Item →</button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function WatconItems() {
  const [items, setItems] = useState(SEED_ITEMS);
  const [view, setView] = useState("list"); // list | detail | new
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [filterImported, setFilterImported] = useState("all");

  const filtered = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.id.toLowerCase().includes(search.toLowerCase());
    const matchImport = filterImported === "all" || (filterImported === "imported" ? item.isImported : !item.isImported);
    return matchSearch && matchImport;
  });

  const openItem = (item) => { setSelected(item); setView("detail"); };
  const goBack = () => { setSelected(null); setView("list"); };
  const saveNew = (item) => { setItems(prev => [item, ...prev]); setView("list"); };

  return (
    <div style={{ fontFamily: "'Zen Kaku Gothic New', 'Noto Sans JP', sans-serif", background: "#f8f7f4", minHeight: 600, color: "#0a0a0a" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@200;300;400&family=Zen+Kaku+Gothic+New:wght@300;400;500&display=swap" rel="stylesheet" />
      <link href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.47.0/tabler-icons.min.css" rel="stylesheet" />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", borderBottom: "1px solid rgba(10,10,10,0.1)", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontFamily: "'Noto Serif JP', serif", fontWeight: 300, fontSize: 15, letterSpacing: "0.2em" }}>WATCON</span>
          <span style={{ fontSize: 9, letterSpacing: "0.4em", color: "#aaa", textTransform: "uppercase" }}>/ Item Management</span>
        </div>
        {view === "list" && (
          <button onClick={() => setView("new")} style={S.btnPrimary}>+ New Item</button>
        )}
      </div>

      <div style={{ padding: "20px 22px" }}>
        {view === "list" && (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
              <div style={{ flex: 1, position: "relative" }}>
                <input style={{ ...S.input, borderBottom: "none", border: "1px solid rgba(10,10,10,0.15)", padding: "8px 12px 8px 32px", background: "#fff" }}
                  placeholder="Search items by name or ID..."
                  value={search} onChange={e => setSearch(e.target.value)} />
                <i className="ti ti-search" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#aaa" }} />
              </div>
              <div style={{ display: "flex", border: "1px solid rgba(10,10,10,0.15)" }}>
                {[["all", "All"], ["domestic", "Domestic"], ["imported", "Imported"]].map(([v, l]) => (
                  <button key={v} onClick={() => setFilterImported(v)}
                    style={{ padding: "8px 14px", fontSize: 10, letterSpacing: "0.2em", background: filterImported === v ? "#0a0a0a" : "#fff", color: filterImported === v ? "#f8f7f4" : "#888", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                    {l}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 11, color: "#aaa", letterSpacing: "0.1em" }}>{filtered.length} items</span>
            </div>
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#ccc", fontSize: 11, letterSpacing: "0.3em" }}>No items found</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
                {filtered.map(item => <ItemCard key={item.id} item={item} onClick={openItem} />)}
              </div>
            )}
          </>
        )}
        {view === "detail" && selected && <ItemDetail item={selected} onBack={goBack} />}
        {view === "new" && <NewItemForm onSave={saveNew} onCancel={goBack} />}
      </div>
    </div>
  );
}
