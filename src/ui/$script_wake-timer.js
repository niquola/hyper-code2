(() => {
  if (window.__hyperWakeTimerInstalled) return;
  window.__hyperWakeTimerInstalled = true;

  const format = (ms) => {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return days ? `${days}d ${hours}h ${minutes}m`
      : hours ? `${hours}h ${minutes}m ${seconds}s`
      : `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  };

  const tick = () => {
    document.querySelectorAll('.wake-timer[data-wake-at]').forEach((el) => {
      const at = Number(el.dataset.wakeAt);
      if (Number.isFinite(at)) el.textContent = format(at - Date.now());
    });
  };
  tick();
  setInterval(tick, 1000);
})();
