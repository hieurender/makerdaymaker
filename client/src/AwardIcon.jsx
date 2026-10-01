export default function AwardIcon({ award, className, size }) {
  if (award.icon) return <img className={className} src={award.icon} alt="" width={size} height={size} />;
  if (award.svg) return <span className={`${className} award-svg`} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: award.svg }} />;
  return null;
}
