// Browser preview: React Native's Alert does nothing on web and the artifact
// viewer blocks window.alert/confirm, so draw a small dialog in the page.
type Btn = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };

function show(title: string, message: string | undefined, buttons: Btn[]) {
  const back = document.createElement('div');
  back.setAttribute('role', 'dialog');
  back.setAttribute('aria-modal', 'true');
  back.style.cssText = 'position:fixed;inset:0;background:rgba(20,33,61,.45);display:flex;align-items:center;justify-content:center;z-index:9999;padding:24px;font-family:Nunito_700Bold,sans-serif';
  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:22px;padding:22px;max-width:340px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,.2)';
  const h = document.createElement('div');
  h.textContent = title;
  h.style.cssText = 'font-family:Fredoka_600SemiBold,sans-serif;font-size:19px;color:#14213D;margin-bottom:8px';
  box.appendChild(h);
  if (message) {
    const p = document.createElement('div');
    p.textContent = message;
    p.style.cssText = 'font-size:15px;color:#55607A;line-height:1.4;margin-bottom:18px;white-space:pre-line';
    box.appendChild(p);
  }
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap';
  const close = () => back.remove();
  buttons.forEach((b) => {
    const el = document.createElement('button');
    el.textContent = b.text ?? 'OK';
    const danger = b.style === 'destructive';
    const cancel = b.style === 'cancel';
    el.style.cssText = `min-height:44px;padding:0 18px;border-radius:22px;border:${cancel ? '2px solid #CBD5E4' : '0'};background:${cancel ? '#fff' : danger ? '#B42318' : '#1D4ED8'};color:${cancel ? '#14213D' : '#fff'};font-family:Nunito_800ExtraBold,sans-serif;font-size:15px;cursor:pointer`;
    el.onclick = () => { close(); b.onPress?.(); };
    row.appendChild(el);
  });
  box.appendChild(row);
  back.appendChild(box);
  document.body.appendChild(back);
  (row.lastChild as HTMLButtonElement | null)?.focus();
}

export const Alert = {
  alert(title: string, message?: string, buttons?: Btn[]) {
    show(title, message, buttons && buttons.length ? buttons : [{ text: 'OK' }]);
  },
};
