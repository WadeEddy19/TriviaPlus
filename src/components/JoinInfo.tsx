import { QRCodeSVG } from 'qrcode.react';

export function joinUrl(code: string): string {
  return `${window.location.origin}/room/${code}`;
}

export function JoinInfo({ code, size = 'normal' }: { code: string; size?: 'normal' | 'large' }) {
  const url = joinUrl(code);
  return (
    <div className={`join-info join-info-${size}`}>
      <div>
        <div className="label">Room code</div>
        <div className="room-code">{code}</div>
        <div className="join-url">
          Join at <strong>{window.location.host}</strong>
        </div>
      </div>
      <div className="qr">
        <QRCodeSVG value={url} size={size === 'large' ? 220 : 132} marginSize={2} bgColor="#ffffff" fgColor="#111" />
      </div>
    </div>
  );
}
