"use strict";

const shocks = {
  imports: {d: 24, s: 0, prompt: "Over several quarters, U.S. households buy more British goods.", horizon: "Medium run · trade", reason: "U.S. importers buy more pounds to pay British sellers. Pound demand shifts right."},
  assets: {d: 0, s: 24, prompt: "British pension funds convert pounds to dollars to buy more U.S. bonds.", horizon: "Short run · portfolio flows", reason: "British investors sell more pounds to obtain dollars. Pound supply shifts right."},
  expectation: {d: 0, s: 18, prompt: "Traders expect the pound to lose value and sell some of their pound holdings today.", horizon: "Short run · expectations", reason: "Traders offer more pounds for sale at each quote. Pound supply shifts right."},
  prices: {d: -16, s: 12, prompt: "Over time, buyers in both countries switch from relatively expensive British goods toward U.S. goods.", horizon: "Long run · relative prices", reason: "U.S. buyers demand fewer pounds for British goods, and British buyers supply more pounds for U.S. goods. Both shifts lower the floating quote."},
  both: {d: 24, s: 24, prompt: "U.S. purchases of British goods increase as British pension funds buy more U.S. bonds. In this scenario the two curve shifts are equal in size.", horizon: "Trade and portfolio flows", reason: "Pound demand and supply both shift right. Quantity rises. These equal shifts leave the floating quote unchanged. With unequal shifts, the quote can rise or fall."},
  custom: {prompt: "Choose how far each curve shifts. Try changing the two shifts independently.", horizon: "Custom shifts"}
};

const initialRate = 1.25;
const initialQuantity = 60;
const number = new Intl.NumberFormat("en-US", {maximumFractionDigits: 2});
const rate = new Intl.NumberFormat("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 4});

function model(d, s) {
  const demandAtPeg = initialQuantity + d;
  const supplyAtPeg = initialQuantity + s;
  return {
    floatRate: initialRate + (d - s) / 160,
    floatQuantity: initialQuantity + (d + s) / 2,
    demandAtPeg,
    supplyAtPeg,
    intervention: demandAtPeg - supplyAtPeg
  };
}

function outcome(d, s, regime) {
  const market = model(d, s);
  const gap = market.intervention;
  const peg = regime === "peg";
  const direction = gap > 0 ? "up" : gap < 0 ? "down" : "same";
  const usd = direction === "up" ? "depreciates" : direction === "down" ? "appreciates" : "is unchanged";
  const action = gap > 0 ? "sell" : gap < 0 ? "buy" : "none";
  return {...market, direction, usd, action, prediction: peg ? action : direction};
}

if (typeof module !== "undefined") module.exports = {model, outcome};
if (typeof document !== "undefined") startLab();

function startLab() {
  const get = id => document.getElementById(id);
  const shock = get("shock"), demand = get("demand"), supply = get("supply");
  const prediction = get("prediction"), reveal = get("reveal"), chart = get("chart");
  const result = get("result");
  let revealed = false;

  const regime = () => document.querySelector('input[name="regime"]:checked').value;
  const signed = value => value > 0 ? "+" + value : String(value);
  function inputs() {
    const selected = shocks[shock.value];
    if (shock.value !== "custom") return selected;
    return {...selected, d: Number(demand.value), s: Number(supply.value)};
  }

  function updateControls() {
    const isPeg = regime() === "peg";
    const current = inputs();
    get("custom").hidden = shock.value !== "custom";
    get("demandValue").textContent = signed(Number(demand.value));
    get("supplyValue").textContent = signed(Number(supply.value));
    get("scenario").textContent = current.prompt;
    get("question").textContent = isPeg ? "Predict the central bank’s action" : "Predict the USD-per-GBP quote";
    const options = isPeg ? [["buy","Buy pounds"],["sell","Sell pounds"],["none","No intervention"]] :
      [["up","Rises"],["down","Falls"],["same","Stays the same"]];
    prediction.replaceChildren(new Option("Choose a prediction", ""), ...options.map(([value, label]) => new Option(label,value)));
    hideOutcome();
  }

  function hideOutcome() {
    revealed = false;
    prediction.value = "";
    reveal.disabled = true;
    result.hidden = true;
    get("hint").hidden = false;
    draw();
  }

  function draw() {
    const selected = inputs();
    const isPeg = regime() === "peg";
    const market = model(selected.d, selected.s);
    get("mode").textContent = isPeg ? "Fixed at 1.25" : "Floating rate";
    get("shiftLegend").hidden = !revealed || (!selected.d && !selected.s);
    get("pegLegend").hidden = !isPeg;
    const baseline = "Initial equilibrium: 1.25 USD per GBP and 60 million GBP per day.";
    chart.setAttribute("aria-label", !revealed ? baseline :
      baseline + (isPeg ? " At the peg, private demand is " + market.demandAtPeg + " and private supply is " + market.supplyAtPeg + " million GBP per day." :
        " New floating equilibrium: " + rate.format(market.floatRate) + " USD per GBP and " + market.floatQuantity + " million GBP per day."));
    drawChart(chart, isPeg, revealed, selected, market);
  }

  function showOutcome() {
    if (!prediction.value) return;
    revealed = true;
    const selected = inputs();
    const isPeg = regime() === "peg";
    const market = outcome(selected.d, selected.s, regime());
    const gap = Math.abs(market.intervention);
    const correct = prediction.value === market.prediction;
    const correctLabel = [...prediction.options].find(option => option.value === market.prediction).text;
    const feedback = correct ? "Correct prediction" : "Model outcome: " + correctLabel.toLowerCase();
    const reason = selected.reason || ["Demand " + shiftWords(selected.d), "Supply " + shiftWords(selected.s)].join(". ") + ".";
    let metrics, explanation;
    if (isPeg) {
      metrics = [["Official quote", "1.25 USD/GBP"],["Private demand at peg", market.demandAtPeg + "m GBP/day"],["Private supply at peg", market.supplyAtPeg + "m GBP/day"]];
      explanation = !gap ? "Private demand equals private supply at the peg. The central bank does not need to intervene in this model." :
        (market.action === "sell" ? "Excess private demand puts depreciation pressure on the dollar. The central bank sells " + gap + " million GBP per day, buys " + number.format(gap * initialRate) + " million USD per day, and loses pound reserves." :
         "Excess private supply puts appreciation pressure on the dollar. The central bank buys " + gap + " million GBP per day, sells " + number.format(gap * initialRate) + " million USD per day, and gains pound reserves.");
      explanation += " Under a float, the quote would be " + rate.format(market.floatRate) + " USD per GBP.";
    } else {
      metrics = [["Initial quote", "1.25 USD/GBP"],["New quote", rate.format(market.floatRate) + " USD/GBP"],["Quantity traded", number.format(market.floatQuantity) + "m GBP/day"]];
      explanation = "The U.S. dollar " + market.usd + " against the pound. Quantity traded " + (market.floatQuantity > initialQuantity ? "rises" : market.floatQuantity < initialQuantity ? "falls" : "stays") + " from 60 to " + number.format(market.floatQuantity) + " million GBP per day.";
      if (market.floatQuantity === initialQuantity) explanation = "The U.S. dollar " + market.usd + " against the pound. Quantity traded stays at 60 million GBP per day.";
    }
    const metricMarkup = metrics.map(([name, value]) => '<div class="metric"><dt>' + name + '</dt><dd>' + value + '</dd></div>').join("");
    result.innerHTML = '<p class="feedback">' + feedback + '</p><h3>' + selected.horizon + '</h3><dl class="metrics">' + metricMarkup + '</dl><p>' + reason + '</p><p>' + explanation + '</p>';
    result.hidden = false;
    get("hint").hidden = true;
    draw();
  }

  function shiftWords(value) {
    return value ? "shifts " + (value > 0 ? "right" : "left") + " by " + Math.abs(value) + " million GBP per day" : "stays fixed";
  }
  shock.addEventListener("change", updateControls);
  document.querySelectorAll('input[name="regime"]').forEach(input => input.addEventListener("change", updateControls));
  [demand, supply].forEach(input => input.addEventListener("input", updateControls));
  prediction.addEventListener("change", () => {
    reveal.disabled = !prediction.value;
    if (revealed) {
      revealed = false;
      result.hidden = true;
      get("hint").hidden = false;
      draw();
    }
  });
  reveal.addEventListener("click", showOutcome);
  get("reset").addEventListener("click", () => {
    shock.value = "imports";
    document.querySelector('input[value="float"]').checked = true;
    demand.value = supply.value = 0;
    updateControls();
  });
  new ResizeObserver(draw).observe(chart);
  updateControls();
}

function drawChart(canvas, peg, revealed, shifts, market) {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  const scale = window.devicePixelRatio || 1;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  const left = 43, right = width - 15, top = 30, bottom = height - 47;
  const low = .45, high = 2.05, maxQuantity = 120;
  const x = quantity => left + (right - left) * quantity / maxQuantity;
  const y = value => bottom - (bottom - top) * (value - low) / (high - low);
  const font = width < 420 ? 10 : 12;
  const ink = "#182d2b", teal = "#14685e", rust = "#a64629", blue = "#294c79";
  function line(x0, y0, x1, y1, color, weight = 1, dash = []) {
    ctx.beginPath();
    ctx.setLineDash(dash);
    ctx.strokeStyle = color;
    ctx.lineWidth = weight;
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function label(value, xpos, ypos, {color = ink, align = "left", weight = 500} = {}) {
    ctx.font = weight + " " + font + "px system-ui";
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(value, xpos, ypos);
  }
  function point(quantity, quote, name, color, dx, dy) {
    ctx.beginPath();
    ctx.arc(x(quantity), y(quote), 4.4, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    label(name, x(quantity) + dx, y(quote) + dy, {color, weight: 740, align: dx < 0 ? "right" : "left"});
  }
  label("USD per GBP", left, 13, {weight: 700});
  for (const tick of [.5, .75, 1, 1.25, 1.5, 1.75, 2]) {
    line(left, y(tick), right, y(tick), "#e1e8df");
    label(tick.toFixed(2), left - 7, y(tick), {align: "right"});
  }
  for (const tick of [0,20,40,60,80,100,120]) {
    line(x(tick), top, x(tick), bottom, "#edf0ea");
    label(String(tick), x(tick), bottom + 13, {align:"center"});
  }
  line(left, top, left, bottom, ink, 1.4);
  line(left, bottom, right, bottom, ink, 1.4);
  label("Quantity of GBP (millions per day)", (left + right) / 2, height - 10, {align: "center", weight:700});
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, right-left, bottom-top);
  ctx.clip();
  line(x(0), y(160 / 80), x(120), y((160 - 120) / 80), teal, 2.4);
  line(x(0), y(40 / 80), x(120), y((120 + 40) / 80), rust, 2.4);
  if (revealed && shifts.d) line(x(0), y((160 + shifts.d) / 80), x(120), y((40 + shifts.d) / 80), teal, 2.5, [7,5]);
  if (revealed && shifts.s) line(x(0), y((40 - shifts.s) / 80), x(120), y((160 - shifts.s) / 80), rust, 2.5, [7,5]);
  if (peg) line(left, y(initialRate), right, y(initialRate), blue, 1.6, [3,4]);
  ctx.restore();
  if (!revealed) {
    point(initialQuantity, initialRate, "E₀", ink, 9, -11);
  } else if (peg) {
    const qd = market.demandAtPeg, qs = market.supplyAtPeg;
    if (qd === qs) point(qd, initialRate, "Qᴅ = Qꜱ", blue, 8, -12);
    else {
      line(x(qs), y(initialRate), x(qd), y(initialRate), blue, 4);
      point(qd, initialRate, "Qᴅ", teal, 7, -11);
      point(qs, initialRate, "Qꜱ", rust, -7, 12);
    }
  } else {
    const same = market.floatRate === initialRate && market.floatQuantity === initialQuantity;
    if (same) point(initialQuantity, initialRate, "E₀ = E₁", ink, 8, -11);
    else {
      point(initialQuantity, initialRate, "E₀", ink, -8, -11);
      point(market.floatQuantity, market.floatRate, "E₁", blue, 8, 11);
    }
  }
}
