// ==UserScript==
// @name        Grok Smuggler for X.com
// @namespace   https://github.com/501Not-Implemented/grok-smuggler
// @version     1.4.1
// @description Export your Grok AI conversations as JSON with embedded images. Single or bulk export. Pair with the offline viewer at https://github.com/501Not-Implemented/grok-smuggler
// @license     MIT
// @author      501-NotImplemented
// @homepageURL https://github.com/501Not-Implemented/grok-smuggler
// @supportURL  https://github.com/501Not-Implemented/grok-smuggler/issues
// @match       https://x.com/*
// @run-at      document-idle
// @connect     x.com
// @connect     ton.x.com
// @noframes
// ==/UserScript==

(function () {
  "use strict";

  const EXPORTER_VERSION = "x-grok-exporter-1.4.1";
  const BEARER = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
  const HISTORY_HASH = "9Hyh5D4-WXLnExZkONSkZg";
  const CONV_HASH_FALLBACK = "nqTys1mtEjrk-hVbkVjZZA";
  const REQUEST_DELAY_MS = 350;

  function getConversationId() {
    return new URLSearchParams(window.location.search).get("conversation");
  }

  function getCsrfToken() {
    const match = document.cookie.match(/ct0=([^;]+)/);
    return match ? match[1] : null;
  }

  function authHeaders() {
    const csrf = getCsrfToken();
    if (!csrf) throw new Error("No CSRF token found — are you logged in?");
    return {
      "authorization": `Bearer ${decodeURIComponent(BEARER)}`,
      "x-csrf-token": csrf,
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-active-user": "yes",
      "content-type": "application/json",
    };
  }

  const FEATURES = {
    creator_subscriptions_tweet_preview_api_enabled: true,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: true,
    responsive_web_jetfuel_frame: true,
    responsive_web_grok_share_attachment_enabled: true,
    responsive_web_grok_annotations_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    content_disclosure_indicator_enabled: true,
    content_disclosure_ai_generated_indicator_enabled: true,
    responsive_web_grok_show_grok_translated_post: true,
    responsive_web_grok_analysis_button_from_backend: true,
    post_ctas_fetch_enabled: true,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: false,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_profile_redirect_enabled: false,
    rweb_tipjar_consumption_enabled: false,
    verified_phone_label_enabled: false,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_enhance_cards_enabled: false,
  };

  async function findConvHash() {
    const entries = performance.getEntriesByType("resource");
    for (const entry of entries) {
      const m = entry.name.match(/\/i\/api\/graphql\/([^/]+)\/GrokConversationItemsByRestId/);
      if (m) return m[1];
    }
    try {
      const scripts = document.querySelectorAll('link[as="script"], script[src]');
      for (const el of scripts) {
        const src = el.src || el.href;
        if (!src || !src.includes("main.")) continue;
        const text = await fetch(src).then(r => r.text());
        const m = text.match(/queryId:"([^"]+)",operationName:"GrokConversationItemsByRestId"/);
        if (m) return m[1];
      }
    } catch {}
    return CONV_HASH_FALLBACK;
  }

  async function apiFetch(hash, operationName, variables) {
    const params = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify(FEATURES),
    });
    const url = `https://x.com/i/api/graphql/${hash}/${operationName}?${params}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: authHeaders(),
      credentials: "include",
    });
    if (!resp.ok) throw new Error(`API ${operationName} returned ${resp.status}`);
    return resp.json();
  }

  // --- Image fetching ---

  async function fetchImageAsBase64(url) {
    try {
      const resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) return null;
      const blob = await resp.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  function cleanGrokRenderTags(text) {
    text = text.replace(/<grok:render[^>]*>[\s\S]*?<\/grok:render>/g, '');
    text = text.replace(/<grok:render[^>]*>\s*\n\s*\d+\s*\n\s*"[^"]*"\s*\n\s*"[^"]*"\s*/g, '');
    return text;
  }

  function extractCardImages(item) {
    const cards = {};
    function parseCard(raw) {
      try {
        const card = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (card.id && card.image && !cards[card.id]) {
          cards[card.id] = {
            url: card.image.thumbnail || card.image.original || '',
            title: card.image.title || '',
            source: card.image.source || '',
            link: card.image.link || '',
          };
        }
      } catch {}
    }
    (item.card_attachments || []).forEach(parseCard);
    if (item.card_attachment) parseCard(item.card_attachment);
    return cards;
  }

  function replaceGrokRenderTags(content, cardImages) {
    if (!Object.keys(cardImages).length) return content;
    const replacer = (match, cardId) => {
      const card = cardImages[cardId];
      if (card?.url) return ` [![${card.source || 'img'}](${card.url})](${card.link || card.url})`;
      return '';
    };
    content = content.replace(/<grok:render[^>]*card_id="([^"]+)"[^>]*>[\s\S]*?<\/grok:render>/g, replacer);
    content = content.replace(/<grok:render[^>]*card_id="([^"]+)"[^>]*>\s*\n\s*\d+\s*\n\s*"[^"]*"\s*\n\s*"[^"]*"/g, replacer);
    return content;
  }

  function extractAttachmentUrls(item) {
    const urls = [];
    if (item.file_attachments) {
      for (const att of item.file_attachments) {
        if (att.url) urls.push({ url: att.url, name: att.file_name || "attachment", type: "user_upload" });
      }
    }
    if (item.media_urls) {
      for (const u of item.media_urls) {
        if (!urls.some(a => a.url === u)) {
          urls.push({ url: u, name: "media", type: "user_upload" });
        }
      }
    }
    return urls;
  }

  // --- Fetch history list (with pagination) ---

  async function fetchAllHistoryItems() {
    const all = [];
    let cursor = null;
    let page = 0;
    while (true) {
      page++;
      const variables = cursor ? { cursor } : {};
      const json = await apiFetch(HISTORY_HASH, "GrokHistory", variables);
      const history = json?.data?.grok_conversation_history;
      if (!history?.items?.length) break;
      all.push(...history.items);
      updateProgress(`Fetching history page ${page} (${all.length} conversations)...`);
      if (!history.cursor) break;
      cursor = history.cursor;
      await sleep(REQUEST_DELAY_MS);
    }
    return all;
  }

  // --- Fetch single conversation messages ---

  async function fetchConversationMessages(convId, hash) {
    const json = await apiFetch(hash, "GrokConversationItemsByRestId", { restId: convId });
    return json;
  }

  // --- Build export ---

  async function buildExport(apiResponse, titleOverride, convUrl, downloadImages) {
    const convData = apiResponse?.data?.grok_conversation_items_by_rest_id;
    if (!convData?.items?.length) return null;

    const allItems = [...convData.items];
    allItems.reverse();

    let userIdx = 0, aiIdx = 0;
    const messages = [];
    let imageCount = 0;

    for (const item of allItems) {
      if (item.is_partial) continue;

      const isUser = item.sender_type === "User";
      if (isUser) userIdx++; else aiIdx++;

      let content = item.message || "";
      const cardImages = extractCardImages(item);
      content = replaceGrokRenderTags(content, cardImages);
      content = cleanGrokRenderTags(content);
      const attachments = [];

      for (const ref of extractAttachmentUrls(item)) {
        imageCount++;
        let dataUri = null;
        if (downloadImages) {
          updateProgress(`Downloading image ${imageCount}...`);
          dataUri = await fetchImageAsBase64(ref.url);
        }
        if (dataUri) {
          attachments.push({ name: ref.name, data: dataUri });
          content += `\n\n![${ref.name}](attachment:${ref.name})`;
        } else {
          attachments.push({ name: ref.name, url: ref.url });
          content += `\n\n![${ref.name}](${ref.url})`;
        }
      }

      const msg = {
        id: isUser ? `user-${userIdx}` : `ai-${aiIdx}`,
        author: isUser ? "user" : "ai",
        content,
        timestamp: item.created_at_ms || null,
      };
      if (attachments.length > 0) msg.attachments = attachments;
      messages.push(msg);
    }

    const title = titleOverride
      || (() => {
        const firstUser = messages.find(m => m.author === "user");
        const t = firstUser?.content || "Grok Conversation";
        return t.length > 60 ? t.slice(0, 60).trim() + "..." : t;
      })();

    return {
      title,
      tags: [],
      author: "grok",
      exporter: EXPORTER_VERSION,
      date: allItems[0]?.created_at_ms ? new Date(allItems[0].created_at_ms).toISOString() : new Date().toISOString(),
      url: convUrl || window.location.href,
      messages,
    };
  }

  // --- Utilities ---

  function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  }

  function formatTimestamp() {
    const d = new Date();
    const offset = -d.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const pad = n => String(Math.abs(n)).padStart(2, "0");
    const tz = `${sign}${pad(Math.floor(offset / 60))}${pad(offset % 60)}`;
    return d.toISOString().slice(0, 19).replace(/:/g, "-") + tz;
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadJson(data) {
    const slug = slugify(data.title);
    const filename = `grok_${slug}_${formatTimestamp()}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    downloadBlob(blob, filename);
  }

  // --- Export single conversation ---

  async function doExport() {
    const convId = getConversationId();
    if (!convId) { showToast("No conversation open"); return; }

    setButtonState("single", "Fetching...", true);
    setButtonState("all", "Export All", true);
    try {
      const hash = await findConvHash();
      const apiResponse = await fetchConversationMessages(convId, hash);
      const data = await buildExport(apiResponse, null, null, true);
      if (!data || data.messages.length === 0) {
        showToast("No messages found in this conversation");
        return;
      }
      downloadJson(data);
      const imgCount = data.messages.reduce((n, m) => n + (m.attachments?.length || 0), 0);
      let msg = `Exported ${data.messages.length} messages`;
      if (imgCount > 0) msg += ` with ${imgCount} images`;
      showToast(msg);
    } catch (err) {
      showToast("Export failed: " + err.message);
      console.error("[X Grok Exporter]", err);
    } finally {
      setButtonState("single", "Export as JSON", false);
      setButtonState("all", "Export All", false);
    }
  }

  // --- Export ALL conversations ---

  async function doExportAll() {
    setButtonState("all", "Starting...", true);
    setButtonState("single", "Export as JSON", true);

    try {
      const historyItems = await fetchAllHistoryItems();
      if (!historyItems.length) {
        showToast("No conversations found");
        return;
      }

      const hash = await findConvHash();
      const exported = [];
      let failed = 0;

      for (let i = 0; i < historyItems.length; i++) {
        const item = historyItems[i];
        const restId = item.grokConversation?.rest_id;
        if (!restId) { failed++; continue; }

        updateProgress(`Exporting ${i + 1}/${historyItems.length}: ${item.title || "untitled"}...`);

        try {
          const apiResp = await fetchConversationMessages(restId, hash);
          const convUrl = `https://x.com/i/grok?conversation=${restId}`;
          const data = await buildExport(apiResp, item.title, convUrl, true);
          if (data && data.messages.length > 0) {
            exported.push(data);
          } else {
            failed++;
          }
        } catch (err) {
          console.warn(`[X Grok Exporter] Failed to export ${restId}:`, err);
          failed++;
        }

        if (i < historyItems.length - 1) await sleep(REQUEST_DELAY_MS);
      }

      if (exported.length === 0) {
        showToast("No conversations could be exported");
        return;
      }

      const filename = `grok_all-conversations_${formatTimestamp()}.json`;
      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
      downloadBlob(blob, filename);

      let msg = `Exported ${exported.length} conversations`;
      if (failed > 0) msg += ` (${failed} failed)`;
      showToast(msg);

    } catch (err) {
      showToast("Export All failed: " + err.message);
      console.error("[X Grok Exporter]", err);
    } finally {
      setButtonState("all", "Export All", false);
      setButtonState("single", "Export as JSON", false);
      hideProgress();
    }
  }

  // --- UI ---

  function createBtn(id, label, bottom, onClick) {
    const btn = document.createElement("button");
    btn.id = id;
    btn.textContent = label;
    btn.title = EXPORTER_VERSION;
    Object.assign(btn.style, {
      position: "fixed",
      bottom: bottom,
      right: "20px",
      zIndex: "9999",
      padding: "10px 18px",
      borderRadius: "10px",
      border: "1px solid rgba(20,184,166,0.3)",
      background: "rgba(15,15,19,0.92)",
      color: "#2dd4bf",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: "13px",
      fontWeight: "600",
      cursor: "pointer",
      backdropFilter: "blur(8px)",
      transition: "all 0.15s",
      boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
    });
    btn.addEventListener("mouseenter", () => {
      if (btn.style.pointerEvents === "none") return;
      btn.style.background = "rgba(20,184,166,0.15)";
      btn.style.borderColor = "rgba(20,184,166,0.5)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = btn.style.pointerEvents === "none"
        ? "rgba(15,15,19,0.7)" : "rgba(15,15,19,0.92)";
      btn.style.borderColor = "rgba(20,184,166,0.3)";
    });
    btn.addEventListener("click", onClick);
    return btn;
  }

  function setButtonState(which, label, disabled) {
    const id = which === "single" ? "x-grok-export-btn" : "x-grok-export-all-btn";
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.textContent = label;
    btn.style.pointerEvents = disabled ? "none" : "auto";
    btn.style.opacity = disabled ? "0.6" : "1";
    btn.style.background = disabled ? "rgba(15,15,19,0.7)" : "rgba(15,15,19,0.92)";
  }

  function updateProgress(msg) {
    let el = document.getElementById("x-grok-progress");
    if (!el) {
      el = document.createElement("div");
      el.id = "x-grok-progress";
      Object.assign(el.style, {
        position: "fixed",
        bottom: "110px",
        right: "20px",
        zIndex: "10000",
        padding: "8px 14px",
        borderRadius: "8px",
        background: "rgba(15,15,19,0.95)",
        color: "#5eead4",
        fontSize: "11px",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        border: "1px solid rgba(20,184,166,0.25)",
        maxWidth: "280px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      });
      document.body.appendChild(el);
    }
    el.textContent = msg;
  }

  function hideProgress() {
    const el = document.getElementById("x-grok-progress");
    if (el) el.remove();
  }

  function showToast(msg) {
    hideProgress();
    const toast = document.createElement("div");
    toast.textContent = msg;
    Object.assign(toast.style, {
      position: "fixed",
      bottom: "110px",
      right: "20px",
      zIndex: "10000",
      padding: "8px 16px",
      borderRadius: "8px",
      background: "rgba(15,15,19,0.95)",
      color: "#e4e4ec",
      fontSize: "12px",
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      border: "1px solid rgba(20,184,166,0.3)",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      transition: "opacity 0.3s",
    });
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = "0"; }, 3500);
    setTimeout(() => toast.remove(), 4000);
  }

  function injectButtons() {
    if (document.getElementById("x-grok-export-btn")) return;
    const singleBtn = createBtn("x-grok-export-btn", "Export as JSON", "20px", doExport);
    const allBtn = createBtn("x-grok-export-all-btn", "Export All", "64px", doExportAll);
    document.body.appendChild(singleBtn);
    document.body.appendChild(allBtn);
  }

  function removeButtons() {
    document.getElementById("x-grok-export-btn")?.remove();
    document.getElementById("x-grok-export-all-btn")?.remove();
  }

  function onRouteChange() {
    if (location.pathname.startsWith("/i/grok")) {
      injectButtons();
    } else {
      removeButtons();
    }
  }

  onRouteChange();

  let lastPath = location.pathname;
  new MutationObserver(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      onRouteChange();
    }
  }).observe(document.body, { childList: true, subtree: true });
})();
