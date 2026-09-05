'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import {
  ArrowDown,
  CalendarDays,
  Download,
  Heart,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react';

const release = {
  version: 'Android 测试版 · 2026.09.05',
  size: '248 MB',
};
const previews = [
  { image: 'calendar', name: '翻翻日历', text: '今天的小快乐，有自己的位置。' },
  { image: 'record', name: '记下一杯', text: '口味、照片、心情，想记多少都可以。' },
  { image: 'onboarding', name: '遇见小酱油', text: '第一次见面，也有人陪你慢慢来。' },
];
const greetings = ['今天也要好好喝一杯', '碰杯！小快乐加一', '不赶时间，慢慢记录', '收到一份软乎乎的喜欢'];

export default function Home() {
  const heroCard = useRef<HTMLDivElement>(null);
  const [greeting, setGreeting] = useState(0);
  const [preview, setPreview] = useState(0);

  const moveHero = (event: React.PointerEvent<HTMLDivElement>) => {
    const card = heroCard.current;
    if (!card || event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty('--tilt-x', (-y * 5).toFixed(2) + 'deg');
    card.style.setProperty('--tilt-y', (x * 7).toFixed(2) + 'deg');
    card.style.setProperty('--glow-x', ((x + 0.5) * 100).toFixed(1) + '%');
    card.style.setProperty('--glow-y', ((y + 0.5) * 100).toFixed(1) + '%');
  };

  const resetHero = () => {
    const card = heroCard.current;
    if (!card) return;
    card.style.setProperty('--tilt-x', '0deg');
    card.style.setProperty('--tilt-y', '0deg');
  };

  return (
    <main>
      <a className="skip-link" href="#download">跳到下载区</a>
      <nav className="nav-shell" aria-label="主导航">
        <a className="brand" href="#top" aria-label="吨吨记首页">
          <Image src="/app/app-icon.png" alt="" width={42} height={42} priority />
          <span>
            <strong>吨吨记</strong>
            <small>DUNDUN JOURNAL</small>
          </span>
        </a>
        <div className="nav-links">
          <a href="#features">能做什么</a>
          <a href="#download">下载与安装</a>
          <a className="nav-download" href="#download">
            <Download aria-hidden="true" /> 下载 App
          </a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="release-pill">
            <span className="pulse-dot" />
            免费内测计划 · 不收取会员费用
          </div>
          <p className="eyebrow">A TINY CUP, A LOVELY DAY</p>
          <h1>
            把今天喝的，
            <span>贴进日历里。</span>
          </h1>
          <p className="hero-lead">
            记录奶茶、咖啡和今天的小心情。把穿搭与美食做成奶油纸贴，再把普通一天变成一页可爱的生活手帐。
          </p>
          <div className="hero-actions">
            <a className="primary-cta" href="#download">
              <span className="cta-icon"><Download /></span>
              <span><strong>把小快乐装进口袋</strong><small>查看 Android / iOS 进度</small></span>
              <ArrowDown className="cta-arrow" />
            </a>
            <a className="text-link" href="#features">先看看里面 <span>→</span></a>
          </div>
          <div className="trust-row" aria-label="产品特点">
            <span><ShieldCheck /> 照片本机保存</span>
            <span><Sparkles /> 免费奶油滤镜</span>
            <span><Heart /> 无图也能记</span>
          </div>
        </div>

        <div
          className="hero-stage"
          onPointerMove={moveHero}
          onPointerLeave={resetHero}
          ref={heroCard}
        >
          <div className="stage-glow" />
          <button className="mascot-card" type="button" onClick={() => setGreeting((greeting + 1) % greetings.length)} aria-label="摸摸小酱油，听一句贴心提醒">
            <div className="mascot-copy">
              <span>来自小酱油的贴心提醒</span>
              <strong aria-live="polite" key={greeting}>{greetings[greeting]}</strong>
              <small>轻轻点我，碰个杯 ↗</small>
            </div>
            <Image
              className="mascot-image"
              src="/app/app-icon.png"
              alt="吨吨记的小酱油角色捧着奶茶"
              width={1024}
              height={1024}
              priority
            />
          </button>
          <div className="phone-card">
            <Image
              src="/app/calendar.png"
              alt="吨吨记奶油风日历界面"
              width={1206}
              height={2622}
              priority
            />
          </div>
          <div className="floating-note note-one"><CalendarDays /> 每天一杯</div>
          <div className="floating-note note-two"><WandSparkles /> 自由创作</div>
          <span className="bubble bubble-one" />
          <span className="bubble bubble-two" />
          <span className="bubble bubble-three" />
        </div>
      </section>

      <section className="peek" id="features" aria-label="产品能力预览">
        <article>
          <span>01</span>
          <CalendarDays />
          <strong>翻一翻日历</strong>
          <p>每杯饮品都会落进当天，慢慢长成你的生活地图。</p>
        </article>
        <article>
          <span>02</span>
          <WandSparkles />
          <strong>贴一贴今天</strong>
          <p>穿搭、美食和照片都能移动、缩放、旋转与收藏。</p>
        </article>
        <article className="download-peek">
          <span>03</span>
          <Heart className="beating-heart" />
          <strong>没照片，也有心情</strong>
          <p>不必填满所有选项，一句可爱的话也值得被记住。</p>
        </article>
      </section>
      <section className="app-preview" aria-labelledby="preview-heading">
        <div className="preview-copy">
          <p className="eyebrow">LITTLE MOMENTS, ALL YOURS</p>
          <h2 id="preview-heading">生活不用很特别，<br />也值得贴起来。</h2>
          <p>先翻翻吨吨记，找找你喜欢的那一页。</p>
          <div className="preview-controls" aria-label="选择 App 预览">
            {previews.map((item, index) => <button type="button" key={item.image} aria-pressed={preview === index} onClick={() => setPreview(index)}><span>0{index + 1}</span>{item.name}<span aria-hidden="true">↗</span></button>)}
          </div>
          <p className="preview-caption" aria-live="polite">{previews[preview].text}</p>
          <small>实际 App 界面预览，不是在线编辑器。</small>
        </div>
        <div className="preview-paper">
          <span className="paper-label">一页小日子 / {String(preview + 1).padStart(2, '0')}</span>
          <Image key={preview} src={`/app/${previews[preview].image}.png`} alt={`吨吨记${previews[preview].name}界面`} width={1206} height={2622} className="preview-screen" />
          <span className="paper-stamp" aria-hidden="true"><Heart /> LITTLE JOY</span>
        </div>
      </section>
      <section className="download-section" id="download" aria-labelledby="download-heading">
        <div className="section-title"><p className="eyebrow">TAKE A LITTLE JOY HOME</p><h2 id="download-heading">下一杯，和你一起记。</h2><p>选你的手机，让小酱油住进口袋里。</p></div>
        <div className="platform-grid">
          <article className="platform-card android-card">
            <span className="platform-badge">ANDROID · 免费内测</span>
            <h3>给安卓的小伙伴</h3>
            <p>测试安装包已就绪，直接下载安装。</p>
            <dl><div><dt>测试包日期</dt><dd>2026.09.05</dd></div><div><dt>安装包大小</dt><dd>{release.size}</dd></div><div><dt>系统要求</dt><dd>Android 7.0 及以上</dd></div></dl>
            <a className="platform-button" href="https://github.com/pwang7874-crypto/Dun-Dun-s-Chronicles/releases/download/v0.1.0-beta/DunDunJi-invite-sticker-20260905.apk" target="_blank" rel="noopener noreferrer"><Download aria-hidden="true" /> 下载 Android 测试包</a>
            <small>目前为测试签名包，正式发布前还需更换签名。安装需要开启“允许未知来源应用”。</small>
            <details><summary>安装前的小提醒</summary><p>请从本页获取安装包。若在微信内无法下载，可在系统浏览器打开本页。遇到安全风险提示请先停止安装并核实来源，不要关闭系统安全防护。</p></details>
          </article>
          <article className="platform-card ios-card">
            <span className="platform-badge">iOS · 筹备中</span>
            <h3>给 iPhone 的小伙伴</h3>
            <p>也给你留好了位置，安装入口还在准备。</p>
            <dl><div><dt>分发状态</dt><dd>尚未开放</dd></div><div><dt>计划入口</dt><dd>TestFlight / App Store</dd></div><div><dt>开放日期</dt><dd>确认后在本页公布</dd></div></dl>
            <button className="platform-button" disabled><Heart aria-hidden="true" /> iOS 版本准备中</button>
            <small>当前没有可安装的 iOS 版本，请勿下载安装安卓 APK。</small>
            <details><summary>为什么不能直接下载 APK？</summary><p>APK 是安卓安装包，不能在 iPhone 上安装。iOS 需要独立构建、签名并完成相应分发流程；准备好后，这里会更新真实安装入口。</p></details>
          </article>
        </div>
      </section>
      <section className="little-notes" aria-labelledby="notes-heading">
        <div><p className="eyebrow">A NOTE FROM 小酱油</p><h2 id="notes-heading">开始前，几句悄悄话。</h2><Image src="/app/app-icon.png" alt="" width={100} height={100} /></div>
        <div className="faq-list">
          <details><summary>内测需要付款吗？</summary><p>本轮内测不收费，不用购买会员。请不要向任何个人二维码付款来获取内测资格。</p></details>
          <details><summary>AI 生图现在能用吗？</summary><p>尚未开放。后续计划通过邀请码限量测试，名额和次数确认后再公布；不承诺无限免费生成。</p></details>
          <details><summary>照片和记录保存在哪里？</summary><p>当前测试版以本机保存为主，尚未开放云同步。卸载应用或清除数据可能丢失记录，请保留原始照片，重要作品及时导出。</p></details>
          <details><summary>为什么有些照片没有抠成贴纸？</summary><p>主体识别能力受设备和照片影响。不支持或识别失败时保留原图，不会把矩形裁剪冒充主体抠图。</p></details>
        </div>
      </section>
      <footer className="site-footer"><a className="brand" href="#top"><Image src="/app/app-icon.png" alt="" width={36} height={36} /><strong>吨吨记</strong></a><span>把普通一天，收藏成喜欢的样子。</span><a href="#top">回到顶部 ↑</a></footer>
    </main>
  );
}
