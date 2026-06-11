(function () {
  const $status = document.getElementById('status')
  const $bar = document.getElementById('progressBar')
  const $progressText = document.getElementById('progressText')
  const $ip = document.getElementById('ipInput')
  const $connect = document.getElementById('connectBtn')
  const $retry = document.getElementById('retryBtn')
  const $forget = document.getElementById('forgetBtn')
  const $quit = document.getElementById('quitBtn')
  const $error = document.getElementById('error')
  const $version = document.getElementById('version')

  function setStatus(msg) {
    $status.textContent = msg
    $error.textContent = ''
  }

  function setError(msg) {
    $error.textContent = msg || ''
  }

  function setProgress(scanned, total) {
    const pct = total ? Math.min(100, Math.round((scanned / total) * 100)) : 0
    $bar.style.width = pct + '%'
    $progressText.textContent = total ? `جربنا ${scanned} من ${total} IP` : '—'
  }

  function resetProgress() {
    $bar.style.width = '0%'
    $progressText.textContent = '—'
  }

  // ─── Wire up controls ────────────────────────────────────────────────────
  $ip.addEventListener('input', () => {
    const v = $ip.value.trim()
    $connect.disabled = v.length < 7 // shortest IPv4 is "1.1.1.1"
  })

  $ip.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !$connect.disabled) $connect.click()
  })

  $connect.addEventListener('click', async () => {
    $connect.disabled = true
    setError('')
    setStatus(`جاري المحاولة على ${$ip.value.trim()}…`)
    try {
      const result = await window.fitboostClient.manualConnect($ip.value.trim())
      if (!result?.ok) {
        setStatus('فشل الاتصال اليدوي')
        setError(result?.error || 'حصل خطأ غير متوقع')
      }
      // on success the main process opens the main window and closes the splash
    } catch (e) {
      setError(String(e?.message || e))
    } finally {
      $connect.disabled = false
    }
  })

  $retry.addEventListener('click', async () => {
    resetProgress()
    setStatus('جاري البحث في الشبكة…')
    setError('')
    await window.fitboostClient.startDiscovery()
  })

  $forget.addEventListener('click', async () => {
    const r = await window.fitboostClient.forgetSavedServer()
    if (r?.ok) setStatus('تم مسح الـ IP المحفوظ — اضغط "إعادة البحث"')
    else setError(r?.error || 'فشل المسح')
  })

  $quit.addEventListener('click', () => window.fitboostClient.quit())

  // ─── Discovery progress listener ─────────────────────────────────────────
  window.fitboostClient.onProgress(({ phase, info }) => {
    switch (phase) {
      case 'saved':
        setStatus(`جاري المحاولة على ${info.ip} (محفوظ)…`)
        break
      case 'saved-failed':
        setStatus('الـ IP المحفوظ ما ردش — جاري البحث في الشبكة…')
        break
      case 'scanning':
        setStatus(`جاري المسح: ${info.subnetPrefix}1-254`)
        setProgress(info.scanned || 0, info.total || 254)
        break
      case 'found':
        setStatus(`اتصل بـ ${info.ip} — جاري التحميل…`)
        $bar.style.width = '100%'
        $progressText.textContent = 'تم العثور على السيستم'
        break
      case 'not-found':
        setStatus('مفيش سيستم اتلقي في الشبكة')
        setError('تأكد إن الجهاز الهوست شغّال على نفس الشبكة. تقدر تجرب IP يدوي.')
        resetProgress()
        break
      case 'no-network':
        setStatus('مفيش شبكة')
        setError('الجهاز مش متصل بأي شبكة Wi-Fi أو LAN')
        break
    }
  })

  // ─── On boot: show version + remembered IP, if any ───────────────────────
  ;(async () => {
    try {
      const info = await window.fitboostClient.getAppInfo()
      if (info?.version) $version.textContent = 'v' + info.version
      if (info?.lastIp) $ip.value = info.lastIp
      $connect.disabled = !info?.lastIp || info.lastIp.length < 7
    } catch {}
  })()
})()
