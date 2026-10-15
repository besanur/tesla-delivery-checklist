(function () {
  "use strict";

  const LEGACY_STORAGE_KEY = "tesla-juniper-checklist-v1";
  const ACTIVE_STATE_KEY = "tesla-checklist-active-v2";
  const REGISTRY_KEY = "tesla-checklists-index-v1";
  const ACTIVE_ID_KEY = "tesla-active-checklist-id";
  const THEME_KEY = "tesla-juniper-checklist-theme";
  const STATE_VERSION = 2;
  const app = document.getElementById("app");

  // ---------- Theme (dark/light) ----------
  function applyTheme(theme) {
    if (theme === "light" || theme === "dark") {
      document.documentElement.setAttribute("data-theme", theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    const btn = document.getElementById("themeToggle");
    if (btn) {
      const effective = theme === "light" || theme === "dark"
        ? theme
        : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      btn.textContent = effective === "dark" ? "☀️" : "🌙";
      btn.setAttribute("aria-label", effective === "dark" ? "Zu hellem Modus wechseln" : "Zu dunklem Modus wechseln");
    }
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
    applyTheme(saved);

    const btn = document.getElementById("themeToggle");
    if (btn) {
      btn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme")
          || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        const next = current === "dark" ? "light" : "dark";
        applyTheme(next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
      });
    }
  }

  initTheme();

  function emptyState() {
    return { version: STATE_VERSION, meta: {}, items: {}, sectionNotes: {}, collapsed: {} };
  }

  function itemKey(sectionId, index) {
    return sectionId + "::" + index;
  }

  function getItemEntry(sectionId, index) {
    const key = itemKey(sectionId, index);
    if (!state.items[key]) {
      state.items[key] = { checked: false, comment: "", photo: null };
    }
    return state.items[key];
  }

  function migrateLegacyV1(rawV1) {
    const next = emptyState();
    next.meta = rawV1.meta || {};
    next.sectionNotes = rawV1.notes || {};
    next.collapsed = rawV1.collapsed || {};
    const oldChecks = rawV1.checks || {};
    Object.keys(oldChecks).forEach((key) => {
      next.items[key] = { checked: !!oldChecks[key], comment: "", photo: null };
    });
    return next;
  }

  // ---------- Multi-checklist registry ----------
  function checklistStorageKey(id) {
    return "tesla-checklist-" + id;
  }

  function loadRegistry() {
    try {
      const raw = localStorage.getItem(REGISTRY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveRegistry(list) {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(list));
  }

  function getActiveId() {
    return localStorage.getItem(ACTIVE_ID_KEY);
  }

  function setActiveId(id) {
    localStorage.setItem(ACTIVE_ID_KEY, id);
  }

  function newChecklistId() {
    return "chk_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function createChecklist(label) {
    const id = newChecklistId();
    const registry = loadRegistry();
    registry.push({ id: id, label: label || "Neue Checkliste", updatedAt: Date.now() });
    saveRegistry(registry);
    localStorage.setItem(checklistStorageKey(id), JSON.stringify(emptyState()));
    setActiveId(id);
    return id;
  }

  function renameChecklist(id, label) {
    const registry = loadRegistry();
    const entry = registry.find((c) => c.id === id);
    if (entry) {
      entry.label = label;
      saveRegistry(registry);
    }
  }

  function deleteChecklist(id) {
    let registry = loadRegistry().filter((c) => c.id !== id);
    localStorage.removeItem(checklistStorageKey(id));
    if (registry.length === 0) {
      const freshId = createChecklist("Fahrzeug 1");
      registry = loadRegistry();
      setActiveId(freshId);
    } else if (getActiveId() === id) {
      setActiveId(registry[0].id);
    }
    saveRegistry(registry);
  }

  function ensureRegistryBootstrapped() {
    let registry = loadRegistry();
    if (registry.length > 0 && getActiveId() && registry.some((c) => c.id === getActiveId())) {
      return;
    }
    const legacyActiveRaw = localStorage.getItem(ACTIVE_STATE_KEY);
    const legacyV1Raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    let seedState = null;
    if (legacyActiveRaw) {
      seedState = JSON.parse(legacyActiveRaw);
    } else if (legacyV1Raw) {
      seedState = migrateLegacyV1(JSON.parse(legacyV1Raw));
    }
    const id = newChecklistId();
    const label = (seedState && seedState.meta && seedState.meta.vin) || "Fahrzeug 1";
    registry = [{ id: id, label: label, updatedAt: Date.now() }];
    saveRegistry(registry);
    localStorage.setItem(checklistStorageKey(id), JSON.stringify(seedState || emptyState()));
    localStorage.removeItem(ACTIVE_STATE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    setActiveId(id);
  }

  function loadActiveChecklistState() {
    ensureRegistryBootstrapped();
    activeChecklistId = getActiveId();
    try {
      const raw = localStorage.getItem(checklistStorageKey(activeChecklistId));
      const parsed = raw ? JSON.parse(raw) : null;
      return {
        version: STATE_VERSION,
        meta: (parsed && parsed.meta) || {},
        items: (parsed && parsed.items) || {},
        sectionNotes: (parsed && parsed.sectionNotes) || {},
        collapsed: (parsed && parsed.collapsed) || {},
      };
    } catch (e) {
      return emptyState();
    }
  }

  function renderChecklistSwitcher() {
    const select = document.getElementById("checklistSelect");
    const registry = loadRegistry();
    select.innerHTML = "";
    registry.forEach((entry) => {
      const opt = document.createElement("option");
      opt.value = entry.id;
      opt.textContent = entry.label;
      if (entry.id === activeChecklistId) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function switchChecklist(id) {
    setActiveId(id);
    state = loadActiveChecklistState();
    renderChecklistSwitcher();
    render();
  }

  let activeChecklistId = null;
  let state = loadActiveChecklistState();
  let saveTimer = null;

  function persist() {
    try {
      localStorage.setItem(checklistStorageKey(activeChecklistId), JSON.stringify(state));
      const registry = loadRegistry();
      const entry = registry.find((c) => c.id === activeChecklistId);
      if (entry) { entry.updatedAt = Date.now(); saveRegistry(registry); }
      flashSaveStatus("Gespeichert " + new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      if (e && e.name === "QuotaExceededError") {
        flashSaveStatus("⚠️ Speicher voll — Foto konnte nicht gespeichert werden");
      } else {
        flashSaveStatus("Speichern fehlgeschlagen");
      }
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 150);
  }

  const saveStatusEl = document.getElementById("saveStatus");
  function flashSaveStatus(text) {
    saveStatusEl.textContent = text;
  }

  function buildMeta() {
    const card = document.createElement("div");
    card.className = "meta-card";
    const title = document.createElement("div");
    title.className = "meta-title";
    title.textContent = "Fahrzeugdaten";
    card.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "meta-grid";

    CHECKLIST_DATA.meta.forEach((field) => {
      const wrap = document.createElement("div");
      wrap.className = "meta-field";
      const label = document.createElement("label");
      label.textContent = field.label;
      label.setAttribute("for", "meta-" + field.id);
      const input = document.createElement("input");
      input.type = field.type || "text";
      input.id = "meta-" + field.id;
      input.autocomplete = "off";
      input.value = state.meta[field.id] || "";
      input.addEventListener("input", () => {
        state.meta[field.id] = input.value;
        scheduleSave();
      });
      wrap.appendChild(label);
      wrap.appendChild(input);
      grid.appendChild(wrap);
    });

    card.appendChild(grid);
    return card;
  }

  // ---------- Generic prompt/confirm/alert dialog (replaces native prompt/confirm/alert) ----------
  function openDialog(opts) {
    const withInput = !!opts.withInput;
    return new Promise((resolve) => {
      const modal = document.getElementById("appDialogModal");
      document.getElementById("dialogTitle").textContent = opts.title || "";

      const msgEl = document.getElementById("dialogMessage");
      if (opts.message) {
        msgEl.textContent = opts.message;
        msgEl.hidden = false;
      } else {
        msgEl.hidden = true;
      }

      const input = document.getElementById("dialogInput");
      input.hidden = !withInput;
      if (withInput) {
        input.value = opts.defaultValue || "";
        if (opts.placeholder) input.placeholder = opts.placeholder;
      }

      const okBtn = document.getElementById("dialogOkBtn");
      const cancelBtn = document.getElementById("dialogCancelBtn");
      okBtn.textContent = opts.confirmLabel || "OK";
      const showCancel = opts.cancelLabel !== null;
      cancelBtn.hidden = !showCancel;
      if (showCancel) cancelBtn.textContent = opts.cancelLabel || "Abbrechen";

      function cleanup(result) {
        modal.hidden = true;
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        modal.removeEventListener("click", onOverlay);
        document.removeEventListener("keydown", onKeydown);
        resolve(result);
      }
      function onOk() { cleanup(withInput ? input.value : true); }
      function onCancel() { cleanup(withInput ? null : false); }
      function onOverlay(e) { if (e.target.id === "appDialogModal") onCancel(); }
      function onKeydown(e) {
        if (e.key === "Enter") { e.preventDefault(); onOk(); }
        if (e.key === "Escape") onCancel();
      }

      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      modal.addEventListener("click", onOverlay);
      document.addEventListener("keydown", onKeydown);

      modal.hidden = false;
      if (withInput) setTimeout(() => input.focus(), 0);
    });
  }

  function openPromptModal(opts) {
    return openDialog(Object.assign({}, opts, { withInput: true }));
  }

  function openConfirmModal(opts) {
    return openDialog(Object.assign({}, opts, { withInput: false }));
  }

  function openAlertModal(opts) {
    return openDialog(Object.assign({}, opts, { withInput: false, cancelLabel: null }));
  }

  // ---------- Item detail modal ----------
  let detailSectionId = null;
  let detailIndex = null;
  let detailListItemEl = null;

  function openItemDetail(sectionId, index, itemText, listItemEl) {
    detailSectionId = sectionId;
    detailIndex = index;
    detailListItemEl = listItemEl;
    const entry = getItemEntry(sectionId, index);

    document.getElementById("detailItemTitle").textContent = itemText;
    document.getElementById("detailComment").value = entry.comment || "";

    const img = document.getElementById("detailPhotoImg");
    const preview = document.getElementById("detailPhotoPreview");
    const emptyHint = document.getElementById("detailPhotoEmptyHint");
    if (entry.photo) {
      img.src = entry.photo;
      preview.hidden = false;
      emptyHint.hidden = true;
    } else {
      img.src = "";
      preview.hidden = true;
      emptyHint.hidden = false;
    }

    document.getElementById("itemDetailModal").hidden = false;
  }

  function closeItemDetail() {
    document.getElementById("itemDetailModal").hidden = true;
    if (detailListItemEl) {
      updateItemBadges(detailListItemEl, getItemEntry(detailSectionId, detailIndex));
    }
    detailSectionId = null;
    detailIndex = null;
    detailListItemEl = null;
  }

  document.getElementById("detailCloseBtn").addEventListener("click", closeItemDetail);
  document.getElementById("itemDetailModal").addEventListener("click", (e) => {
    if (e.target.id === "itemDetailModal") closeItemDetail();
  });

  document.getElementById("detailComment").addEventListener("input", (e) => {
    if (detailSectionId === null) return;
    getItemEntry(detailSectionId, detailIndex).comment = e.target.value;
    scheduleSave();
  });

  function resizeImageFile(file, maxDim, quality) {
    maxDim = maxDim || 1280;
    quality = quality || 0.72;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
        img.onload = () => {
          let width = img.naturalWidth;
          let height = img.naturalHeight;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round(height * (maxDim / width));
              width = maxDim;
            } else {
              width = Math.round(width * (maxDim / height));
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function handlePhotoFile(fileInput) {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!file || detailSectionId === null) return;
    resizeImageFile(file, 1280, 0.72)
      .then((dataUrl) => {
        const entry = getItemEntry(detailSectionId, detailIndex);
        entry.photo = dataUrl;
        scheduleSave();
        document.getElementById("detailPhotoImg").src = dataUrl;
        document.getElementById("detailPhotoPreview").hidden = false;
        document.getElementById("detailPhotoEmptyHint").hidden = true;
      })
      .catch((err) => {
        console.warn("Foto konnte nicht verarbeitet werden", err);
        openAlertModal({ title: "Foto fehlgeschlagen", message: "Das Foto konnte nicht verarbeitet werden. Bitte erneut versuchen." });
      });
  }

  document.getElementById("detailCaptureInput").addEventListener("change", (e) => {
    handlePhotoFile(e.target);
  });
  document.getElementById("detailUploadInput").addEventListener("change", (e) => {
    handlePhotoFile(e.target);
  });

  document.getElementById("detailRemovePhotoBtn").addEventListener("click", () => {
    if (detailSectionId === null) return;
    getItemEntry(detailSectionId, detailIndex).photo = null;
    scheduleSave();
    document.getElementById("detailPhotoImg").src = "";
    document.getElementById("detailPhotoPreview").hidden = true;
    document.getElementById("detailPhotoEmptyHint").hidden = false;
  });

  function updateSectionBadge(sectionEl, total, done) {
    const countEl = sectionEl.querySelector("[data-count]");
    countEl.textContent = done + " / " + total;
    sectionEl.classList.toggle("done", total > 0 && done === total);
  }

  function buildSection(section) {
    const tpl = document.getElementById("sectionTemplate");
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.dataset.sectionId = section.id;
    node.querySelector("[data-title]").textContent = section.title;

    const isCollapsed = !!state.collapsed[section.id];
    node.classList.toggle("collapsed", isCollapsed);

    const itemsRoot = node.querySelector("[data-items]");
    const itemTpl = document.getElementById("itemTemplate");
    let doneCount = 0;

    section.items.forEach((text, index) => {
      const li = itemTpl.content.firstElementChild.cloneNode(true);
      const entry = getItemEntry(section.id, index);
      const checkbox = li.querySelector("[data-check]");
      const textEl = li.querySelector("[data-text]");
      textEl.textContent = text;
      checkbox.checked = entry.checked;
      if (entry.checked) doneCount++;
      updateItemBadges(li, entry);

      checkbox.addEventListener("change", () => {
        entry.checked = checkbox.checked;
        scheduleSave();
        updateSectionBadge(node, section.items.length, countChecked(section));
        updateOverallProgress();
      });

      li.querySelector("[data-detail-btn]").addEventListener("click", () => {
        openItemDetail(section.id, index, text, li);
      });

      itemsRoot.appendChild(li);
    });

    const notesField = node.querySelector("[data-notes]");
    notesField.value = state.sectionNotes[section.id] || "";
    notesField.addEventListener("input", () => {
      state.sectionNotes[section.id] = notesField.value;
      scheduleSave();
    });

    updateSectionBadge(node, section.items.length, doneCount);

    node.querySelector("[data-toggle]").addEventListener("click", () => {
      const collapsed = node.classList.toggle("collapsed");
      state.collapsed[section.id] = collapsed;
      scheduleSave();
    });

    return node;
  }

  function updateItemBadges(li, entry) {
    const commentBadge = li.querySelector("[data-badge-comment]");
    const photoBadge = li.querySelector("[data-badge-photo]");
    commentBadge.hidden = !(entry.comment && entry.comment.trim());
    photoBadge.hidden = !entry.photo;
  }

  function countChecked(section) {
    let n = 0;
    section.items.forEach((_, index) => {
      const key = itemKey(section.id, index);
      if (state.items[key] && state.items[key].checked) n++;
    });
    return n;
  }

  function totalCounts() {
    let total = 0, done = 0;
    CHECKLIST_DATA.sections.forEach((s) => {
      total += s.items.length;
      done += countChecked(s);
    });
    return { total, done };
  }

  const progressFill = document.getElementById("progressFill");
  const progressLabel = document.getElementById("progressLabel");
  function updateOverallProgress() {
    const { total, done } = totalCounts();
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    progressFill.style.width = pct + "%";
    progressLabel.textContent = done + " / " + total;
  }

  function render() {
    app.innerHTML = "";
    app.appendChild(buildMeta());
    CHECKLIST_DATA.sections.forEach((section) => {
      app.appendChild(buildSection(section));
    });
    updateOverallProgress();
  }

  render();
  renderChecklistSwitcher();

  document.getElementById("checklistSelect").addEventListener("change", (e) => {
    switchChecklist(e.target.value);
  });

  document.getElementById("newChecklistBtn").addEventListener("click", async () => {
    const label = await openPromptModal({
      title: "Neue Checkliste",
      message: "Name für die neue Checkliste (z.B. Fahrzeug 2):",
      defaultValue: "Neues Fahrzeug",
      confirmLabel: "Anlegen",
    });
    if (label === null) return;
    const id = createChecklist(label.trim() || "Neues Fahrzeug");
    switchChecklist(id);
  });

  document.getElementById("renameChecklistBtn").addEventListener("click", async () => {
    const registry = loadRegistry();
    const current = registry.find((c) => c.id === activeChecklistId);
    const label = await openPromptModal({
      title: "Checkliste umbenennen",
      defaultValue: current ? current.label : "",
      confirmLabel: "Speichern",
    });
    if (label === null || !label.trim()) return;
    renameChecklist(activeChecklistId, label.trim());
    renderChecklistSwitcher();
  });

  document.getElementById("deleteChecklistBtn").addEventListener("click", async () => {
    if (loadRegistry().length <= 1) {
      await openAlertModal({ title: "Nicht möglich", message: "Die letzte Checkliste kann nicht gelöscht werden." });
      return;
    }
    const confirmed = await openConfirmModal({
      title: "Checkliste löschen",
      message: "Diese Checkliste inklusive aller Haken, Kommentare und Fotos endgültig löschen?",
      confirmLabel: "Löschen",
    });
    if (!confirmed) return;
    deleteChecklist(activeChecklistId);
    switchChecklist(getActiveId());
  });

  // ---------- Reset ----------
  document.getElementById("resetBtn").addEventListener("click", async () => {
    const confirmed = await openConfirmModal({
      title: "Zurücksetzen",
      message: "Wirklich alle Haken, Kommentare, Fotos und Felder dieser Checkliste zurücksetzen?",
      confirmLabel: "Zurücksetzen",
    });
    if (!confirmed) return;
    state = emptyState();
    persist();
    render();
  });

  // ---------- PDF export ----------
  document.getElementById("exportPdfBtn").addEventListener("click", exportPdf);

  function exportPdf() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginL = 50, marginR = 50;
    const contentW = pageW - marginL - marginR;
    const red = [204, 0, 0];
    let y = 0;

    function newPage() {
      doc.addPage();
      y = 60;
    }
    function ensureSpace(h) {
      if (y + h > pageH - 50) newPage();
    }

    // Title block
    doc.setFillColor(red[0], red[1], red[2]);
    doc.rect(0, 0, pageW, 110, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Tesla Model Y Juniper", marginL, 55);
    doc.setFontSize(14);
    doc.text("Delivery Day Checkliste", marginL, 78);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Exportiert am " + new Date().toLocaleString("de-DE"), marginL, 95);

    y = 140;
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Fahrzeugdaten", marginL, y);
    y += 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    CHECKLIST_DATA.meta.forEach((field) => {
      ensureSpace(18);
      const val = state.meta[field.id] || "—";
      doc.setTextColor(90, 90, 90);
      doc.text(field.label + ":", marginL, y);
      doc.setTextColor(20, 20, 20);
      doc.text(String(val), marginL + 120, y);
      y += 18;
    });

    y += 8;
    doc.setDrawColor(220, 220, 220);
    doc.line(marginL, y, pageW - marginR, y);
    y += 20;

    function drawSectionTitle(title) {
      ensureSpace(30);
      doc.setTextColor(red[0], red[1], red[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(title, marginL, y);
      y += 6;
      doc.setDrawColor(red[0], red[1], red[2]);
      doc.setLineWidth(1.2);
      doc.line(marginL, y, pageW - marginR, y);
      doc.setLineWidth(1);
      y += 16;
    }

    function drawCheckItem(text, entry) {
      const checked = !!entry.checked;
      const hasPhoto = !!entry.photo;
      const hasComment = !!(entry.comment && entry.comment.trim());
      const thumbW = 70, thumbH = 52;
      const textWrapWidth = contentW - 24 - (hasPhoto ? thumbW + 10 : 0);
      const lines = doc.splitTextToSize(text, textWrapWidth);
      let h = lines.length * 13 + 8;
      if (hasPhoto) h = Math.max(h, thumbH + 12);
      ensureSpace(h);
      const boxY = y - 8;

      doc.setDrawColor(40, 40, 40);
      if (checked) {
        doc.setFillColor(red[0], red[1], red[2]);
        doc.rect(marginL, boxY, 11, 11, "FD");
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(1.3);
        doc.line(marginL + 2.5, boxY + 5.5, marginL + 4.5, boxY + 8.5);
        doc.line(marginL + 4.5, boxY + 8.5, marginL + 8.5, boxY + 2.5);
        doc.setLineWidth(1);
      } else {
        doc.rect(marginL, boxY, 11, 11, "D");
      }

      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      const textX = marginL + 20;
      lines.forEach((line, i) => {
        doc.text(line, textX, y + i * 13);
      });

      if (hasPhoto) {
        try {
          doc.addImage(entry.photo, "JPEG", pageW - marginR - thumbW, boxY - 2, thumbW, thumbH);
        } catch (e) {
          console.warn("Foto konnte nicht ins PDF eingebettet werden", e);
        }
      }

      y += h;

      if (hasComment) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9.5);
        doc.setTextColor(90, 90, 90);
        const commentLines = doc.splitTextToSize("Kommentar: " + entry.comment.trim(), contentW - 24);
        commentLines.forEach((line) => {
          ensureSpace(13);
          doc.text(line, textX, y);
          y += 13;
        });
        doc.setFont("helvetica", "normal");
        y += 4;
      }
    }

    function drawNotes(notesText) {
      ensureSpace(14);
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text("Notizen:", marginL, y);
      y += 13;
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(10);
      const text = notesText && notesText.trim() ? notesText.trim() : "—";
      const lines = doc.splitTextToSize(text, contentW);
      lines.forEach((line) => {
        ensureSpace(14);
        doc.text(line, marginL, y);
        y += 14;
      });
      y += 10;
    }

    CHECKLIST_DATA.sections.forEach((section) => {
      drawSectionTitle(section.title);
      section.items.forEach((text, index) => {
        drawCheckItem(text, getItemEntry(section.id, index));
      });
      drawNotes(state.sectionNotes[section.id]);
    });

    const { total, done } = totalCounts();
    ensureSpace(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text("Gesamtfortschritt: " + done + " / " + total + " Punkte geprüft", marginL, y);

    const vin = state.meta.vin ? state.meta.vin.replace(/[^A-Za-z0-9]/g, "") : "checkliste";
    doc.save("Tesla_Model_Y_Juniper_" + vin + ".pdf");
  }
})();
