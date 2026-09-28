const KEY = 'jasannot-data-v4';

// 초기 데이터 구조 정의
let db = JSON.parse(localStorage.getItem(KEY) || 'null') || {
  assets: [
    { id: crypto.randomUUID(), name: '신한은행', active: true },
    { id: crypto.randomUUID(), name: '카카오뱅크', active: true },
    { id: crypto.randomUUID(), name: '케이뱅크', active: true },
    { id: crypto.randomUUID(), name: '국민은행', active: true },
    { id: crypto.randomUUID(), name: '현금/기타', active: true }
  ],
  snapshots: [],
  incomes: []
};

const $ = s => document.querySelector(s);
const fmt = n => Number(n || 0).toLocaleString('ko-KR') + '원';

// 스냅샷 내 모든 자산 금액 합산 (자산 삭제 시 과거 데이터 왜곡 방지)
function total(snapshot) {
  if (!snapshot || !snapshot.balances) return 0;
  return Object.values(snapshot.balances).reduce((sum, v) => sum + Number(v || 0), 0);
}

function activeAssets() {
  return db.assets.filter(a => a.active);
}

function sortedSnapshots() {
  return [...db.snapshots].sort((a, b) => a.date.localeCompare(b.date));
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(db));
  render();
}

// 월별 데이터 및 저축액/지출액 핵심 정산 로직
function monthly() {
  const snapshots = sortedSnapshots();
  const byMonth = {};

  snapshots.forEach(s => {
    const k = s.date.slice(0, 7);
    (byMonth[k] ??= []).push(s);
  });

  const months = Object.keys(byMonth).sort().reverse();

  return months.map(k => {
    const records = byMonth[k];
    const last = records[records.length - 1];

    // 직전 달의 가장 마지막 스냅샷 조회
    const prev = snapshots.filter(s => s.date < records[0].date).at(-1);

    // 해당 월 수입 합산
    const income = db.incomes
      .filter(i => i.date.slice(0, 7) === k)
      .reduce((sum, i) => sum + Number(i.amount), 0);

    // 순 저축 변동액 = 이번 달 마지막 잔액 - 직전 달 마지막 잔액
    const saving = prev && last ? total(last) - total(prev) : 0;

    // 지출액 = 수입액 - 순저축액 (수입이 입력되어 있고 직전 잔액이 있는 경우에만 산출)
    const spend = (income > 0 && prev) ? income - saving : null;

    return { k, records, last, prev, income, saving, spend };
  });
}

function render() {
  const ms = monthly();
  const currentYear = new Date().getFullYear().toString();

  // 올해 총 저축액 산출
  const yearSaving = ms
    .filter(m => m.k.startsWith(currentYear))
    .reduce((sum, m) => sum + m.saving, 0);

  // 올해 총 지출액 산출
  const yearSpend = ms
    .filter(m => m.k.startsWith(currentYear) && m.spend !== null)
    .reduce((sum, m) => sum + (m.spend > 0 ? m.spend : 0), 0);

  const latestSnapshot = sortedSnapshots().at(-1);

  $('#yearSaving').textContent = fmt(yearSaving);
  $('#yearSpend').textContent = fmt(yearSpend);
  $('#currentMoney').textContent = latestSnapshot ? fmt(total(latestSnapshot)) : fmt(0);

  const monthsContainer = $('#months');
  if (!ms.length) {
    monthsContainer.innerHTML = `<div class="empty">아직 기록이 없습니다.<br>우측 상단의 <b>＋ 잔액 입력</b>을 눌러 시작해 보세요.</div>`;
    return;
  }

  const latestMonthKey = ms[0]?.k;

  monthsContainer.innerHTML = ms.map(m => {
    const savingFmt = m.saving > 0 ? `+${fmt(m.saving)}` : fmt(m.saving);
    const savingClass = m.saving > 0 ? 'plus' : (m.saving < 0 ? 'minus' : '');

    return `
      <article class="month">
        <button class="monthBtn" data-k="${m.k}">
          <div class="monthTop">
            <span class="monthName">${m.k.replace('-', '년 ')}월</span>
            <span class="status">${m.k === latestMonthKey ? '진행 중' : '확정'}</span>
          </div>
          <div class="flow">
            <div>
              <span>보유 자산</span>
              <b>${fmt(total(m.last))}</b>
            </div>
            <div>
              <span>월 순저축액</span>
              <b class="${savingClass}">${savingFmt}</b>
            </div>
            <div>
              <span>월 지출액</span>
              <b>${m.spend === null ? '—' : fmt(m.spend)}</b>
            </div>
          </div>
        </button>
        <div class="details hidden" id="d-${m.k}">
          ${m.records.map(r => `
            <div class="record">
              <div class="recordLine">
                <b>${r.date}</b>
                <span>${fmt(total(r))}</span>
              </div>
              <small>${r.memo || '메모 없음'}</small>
            </div>
          `).join('')}
        </div>
      </article>
    `;
  }).join('');

  document.querySelectorAll('.monthBtn').forEach(b => {
    b.onclick = () => $('#d-' + b.dataset.k).classList.toggle('hidden');
  });
}

function openRecordModal() {
  $('#modal').classList.remove('hidden');
  $('#date').value = new Date().toISOString().slice(0, 10);
  $('#income').value = '';
  $('#memo').value = '';
  buildAssetInputs();
}

function buildAssetInputs() {
  const prevSnapshot = sortedSnapshots().at(-1);

  $('#assetInputs').innerHTML = activeAssets().map(a => {
    const prevVal = prevSnapshot?.balances?.[a.id];
    const placeholder = prevVal !== undefined ? fmt(prevVal).replace('원', '') : '0';

    return `
      <div class="assetRow">
        <label for="bal-${a.id}">${a.name}</label>
        <input id="bal-${a.id}" data-a="${a.id}" class="bal" inputmode="numeric" placeholder="${placeholder}">
      </div>
    `;
  }).join('');

  // 천 단위 콤마 자동 포맷팅
  document.querySelectorAll('.bal').forEach(input => {
    input.oninput = () => {
      const val = input.value.replace(/,/g, '').replace(/\D/g, '');
      input.value = val ? Number(val).toLocaleString('ko-KR') : '';
    };
  });
}

// 이벤트 리스너 등록
$('#newBtn').onclick = openRecordModal;
$('#closeBtn').onclick = $('#cancelBtn').onclick = () => $('#modal').classList.add('hidden');

$('#income').oninput = e => {
  const val = e.target.value.replace(/,/g, '').replace(/\D/g, '');
  e.target.value = val ? Number(val).toLocaleString('ko-KR') : '';
};

$('#saveBtn').onclick = () => {
  const date = $('#date').value;
  if (!date) return alert('날짜를 입력해주세요.');

  const prevSnapshot = sortedSnapshots().at(-1);
  const balances = { ...(prevSnapshot?.balances || {}) };

  document.querySelectorAll('.bal').forEach(input => {
    if (input.value !== '') {
      balances[input.dataset.a] = Number(input.value.replace(/,/g, ''));
    }
  });

  db.snapshots.push({
    id: crypto.randomUUID(),
    date,
    balances,
    memo: $('#memo').value.trim()
  });

  const incomeVal = $('#income').value.replace(/,/g, '');
  if (incomeVal !== '') {
    const month = date.slice(0, 7);
    db.incomes = db.incomes.filter(i => i.date.slice(0, 7) !== month);
    db.incomes.push({
      id: crypto.randomUUID(),
      date,
      amount: Number(incomeVal)
    });
  }

  $('#modal').classList.add('hidden');
  save();
};

$('#addAssetInRecord').onclick = () => {
  const name = prompt('새 통장 또는 자산 이름');
  if (!name?.trim()) return;
  db.assets.push({ id: crypto.randomUUID(), name: name.trim(), active: true });
  buildAssetInputs();
};

// 자산 관리 모달
$('#manageBtn').onclick = () => {
  $('#assetModal').classList.remove('hidden');
  renderAssetManager();
};

$('#assetClose').onclick = $('#assetDone').onclick = () => $('#assetModal').classList.add('hidden');

$('#addAsset').onclick = () => {
  const name = prompt('추가할 자산 이름');
  if (name?.trim()) {
    db.assets.push({ id: crypto.randomUUID(), name: name.trim(), active: true });
    renderAssetManager();
    save();
  }
};

function renderAssetManager() {
  $('#assetList').innerHTML = activeAssets().map(a => `
    <div class="assetManageRow">
      <input data-id="${a.id}" class="assetNameInput" value="${a.name}">
      <button class="dangerBtn" data-del="${a.id}">삭제</button>
    </div>
  `).join('');

  document.querySelectorAll('.assetNameInput').forEach(input => {
    input.onchange = () => {
      const asset = db.assets.find(a => a.id === input.dataset.id);
      if (asset) asset.name = input.value.trim() || '이름 없는 자산';
      save();
    };
  });

  document.querySelectorAll('[data-del]').forEach(btn => {
    btn.onclick = () => {
      if (confirm('이 자산을 비활성화할까요? 기존 기록의 금액 계산은 그대로 유지됩니다.')) {
        const asset = db.assets.find(a => a.id === btn.dataset.del);
        if (asset) asset.active = false;
        renderAssetManager();
        save();
      }
    };
  });
}

render();