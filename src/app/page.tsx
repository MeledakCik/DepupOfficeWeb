import Image from "next/image";
import { ArrowDown, ArrowRight, ArrowUpRight, Camera, FileCheck2, FileSpreadsheet, FileText, Folder, Layers3, ScanLine, ShieldCheck, Smartphone, Upload } from "lucide-react";
import { LegacyWorkspaceLink } from "@/components/legacy-workspace-link";
import styles from "./landing.module.css";

const features = [
  { name: "Pindai dari kamera", text: "Luruskan halaman, sensor bagian sensitif, lalu simpan sebagai PDF atau Word.", icon: ScanLine, href: "/office/#scan", action: "Buka pemindai" },
  { name: "Olah PDF", text: "Gabung, susun, kompres, dan tanda tangani PDF dari satu ruang kerja.", icon: Layers3, href: "/office/#alat", action: "Lihat alat PDF" },
  { name: "Kerjakan berkas Office", text: "Sunting Word dan Excel, pakai template, atau buka presentasi PowerPoint.", icon: FileSpreadsheet, href: "/office/#dokumen", action: "Buka dokumen" },
];

export default function LandingPage() {
  return <div id="atas" className={styles.landing}>
    <LegacyWorkspaceLink />
    <a className="skip-link" href="#utama">Lewati ke konten</a>
    <header className={styles.header}>
      <a className={styles.brand} href="#atas" aria-label="DepUp Office, awal halaman">
        <Image src="/brand/depup-mark.png" width={32} height={32} unoptimized alt="" />
        <span>DepUp <b>Office</b></span>
      </a>
      <nav className={styles.nav} aria-label="Navigasi landing">
        <a href="#fitur">Fitur</a>
        <a href="#privasi">Privasi</a>
      </nav>
      <a className={styles.headerAction} href="/office/"><span>Ruang kerja</span><ArrowUpRight size={17} /></a>
    </header>

    <main id="utama" tabIndex={-1}>
      <section className={styles.hero} aria-labelledby="hero-heading">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span /> Ruang kerja dokumen</p>
          <h1 id="hero-heading">Dokumen beres.<br /><span>Kerja lebih ringan.</span></h1>
          <p className={styles.heroDescription}>Dari foto kertas hingga PDF, Word, dan Excel. Pindai, sunting, dan kelola semuanya langsung di browser.</p>
          <div className={styles.heroActions}>
            <a className={styles.primary} href="/office/">Buka ruang kerja <ArrowUpRight size={19} /></a>
            <a className={styles.more} href="#fitur">Jelajahi fitur <ArrowDown size={17} /></a>
          </div>
          <p className={styles.local}><ShieldCheck size={16} /> Berkas diproses di perangkat Anda</p>
        </div>
        <div className={styles.scene} aria-hidden="true">
          <div className={styles.orbit} />
          <div className={styles.orbitInner} />
          <picture className={styles.sculpture}>
            <source media="(max-width: 640px)" srcSet="/brand/glass-pages-480.webp" />
            <Image src="/brand/glass-pages-880.webp" alt="" width={880} height={1040} unoptimized loading="eager" fetchPriority="high" />
          </picture>
          <span className={styles.sceneTag}><FileText size={17} /> PDF</span>
          <span className={styles.sceneTag}><FileSpreadsheet size={17} /> XLSX</span>
          <span className={styles.sceneTag}><Camera size={17} /> Scan</span>
        </div>
      </section>

      <section className={styles.features} id="fitur" aria-labelledby="features-heading">
        <div className={styles.sectionTitle}>
          <h2 id="features-heading">Dari pindai sampai siap kirim.</h2>
          <a className={styles.more} href="/office/#alat">Lihat semua alat <ArrowRight size={18} /></a>
        </div>
        <div className={styles.featureGrid}>
          {features.map(({ name, text, icon: Icon, href, action }) => <a href={href} className={styles.feature} key={name}>
            <span className={styles.featureIcon}><Icon size={24} /></span>
            <h3>{name}</h3><p>{text}</p>
            <span className={styles.featureAction}>{action}<ArrowUpRight size={16} /></span>
          </a>)}
        </div>
      </section>

      <section className={styles.showcase} aria-labelledby="showcase-heading">
        <div className={styles.showcaseCopy}>
          <h2 id="showcase-heading">Ruang kerja di setiap ukuran layar.</h2>
          <p>Bilah samping memberi ruang untuk bekerja di desktop. Di ponsel, dokumen, kamera, dan alat bisa dijangkau dari bilah bawah.</p>
          <a className={styles.more} href="/office/">Coba ruang kerja <ArrowUpRight size={17} /></a>
        </div>
        <figure className={styles.devices}>
          <Image className={styles.desktopPreview} src="/brand/workspace-desktop.webp" alt="Contoh Beranda DepUp Office pada desktop dengan navigasi di sisi kiri" width={1060} height={658} unoptimized />
          <Image className={styles.mobilePreview} src="/brand/workspace-mobile.webp" alt="Contoh Beranda DepUp Office dalam tema gelap dengan navigasi bawah pada ponsel" width={308} height={667} unoptimized />
        </figure>
      </section>

      <section className={styles.privacy} id="privasi" aria-labelledby="privacy-heading">
        <div className={styles.privacyCopy}>
          <ShieldCheck size={29} />
          <h2 id="privacy-heading">Berkas Anda tetap di perangkat.</h2>
          <p>Scan, konversi, dan penyuntingan berjalan secara lokal. Simpan salinan ke perangkat untuk membawa dokumen ke browser atau perangkat lain.</p>
        </div>
        <div className={styles.privacyDetails}>
          <article><Folder size={22} /><div><h3>Penyimpanan browser</h3><p>Dokumen dan hasil olahan tersedia di ruang kerja pada browser ini.</p></div></article>
          <article><FileCheck2 size={22} /><div><h3>PDF dengan kata sandi</h3><p>PDF standar dapat dibuka atau diberi kata sandi di web.</p></div></article>
          <article><Smartphone size={22} /><div><h3>Dokumen Terlindungi DepUp</h3><p>Buka format khusus ini di DepUp Office Android untuk pembatasan tangkapan layar dan penyuntingan.</p></div></article>
        </div>
      </section>

      <section className={styles.final} aria-labelledby="final-heading">
        <h2 id="final-heading">Siap mengerjakan dokumen?</h2>
        <a className={styles.primary} href="/office/"><Upload size={18} /> Buka ruang kerja</a>
      </section>
    </main>

    <footer className={styles.footer}><span>DepUp Office</span><a href="#atas">Kembali ke atas <ArrowRight size={15} /></a></footer>
  </div>;
}
