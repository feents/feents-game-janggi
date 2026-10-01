import logoMark from '../assets/logo-mark.svg';

export default function Header() {
  return (
    <header className="site-header">
      <div className="header__left">
        <a className="header__brand" href="/" aria-label="FEENTS 장기 홈">
          <img className="header__logo-img" src={logoMark} alt="" width="28" height="28" />
          <span className="header__wordmark">FEENTS</span>
        </a>
        <span className="header__crumb"><b>F</b> · Finger</span>
        <span className="header__divider" aria-hidden="true" />
        <span className="header__game-label">장기</span>
      </div>
      <span className="header__status"><span className="status-dot" />나만의 장기 한 판</span>
    </header>
  );
}
