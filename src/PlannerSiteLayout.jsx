import React from 'react';

const storefront = 'https://closetswarehouse.com';
const logo = `${storefront}/cdn/shop/files/closet-warehouseplogo.png?v=1782145175&width=360`;
const shopLinks = [
  ['Reach-in Closets', '/collections/reach-in-towers'],
  ['Walk-in Closets', '/collections/walk-in-closets-systems'],
  ['Hardware & Parts', '/collections/hardware-and-parts'],
  ['Our Story', '/pages/contact'],
];
const resources = [
  ['Frequently Asked Questions', '/pages/faq'],
  ['Assembly Instructions', '/pages/closets-warehouse-kits-assembly-instructions'],
  ['Our Story', '/pages/contact'],
  ['Pro Account', '/pages/pro-account'],
  ['Measuring Your Space', '/pages/measure-your-closet-space'],
  ['Closet Guides', '/blogs/guides'],
];
const policies = [
  ['Privacy policy', '/policies/privacy-policy'],
  ['Refund policy', '/policies/refund-policy'],
  ['Contact information', '/policies/contact-information'],
  ['Terms of service', '/policies/terms-of-service'],
  ['Shipping policy', '/policies/shipping-policy'],
  ['Legal notice', '/policies/legal-notice'],
];
const linkClass = 'underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4';

function StorefrontLinks({ links, className, target }) {
  return (
    <ul className={className}>
      {links.map(([label, path]) => (
        <li key={path}><a className={linkClass} href={storefront + path} target={target}>{label}</a></li>
      ))}
    </ul>
  );
}

export default function PlannerSiteLayout({ children }) {
  const embedded = window.parent !== window;
  const params = new URLSearchParams(window.location.search);
  const recentPlan = params.get('recentPlanEmbed') === '1';
  if (embedded && !(recentPlan && params.get('plannerFooter') === '1')) return children;
  const footerLinkTarget = embedded ? '_top' : undefined;

  return (
    <>
      {!embedded && <header data-planner-site-header className="print-hide border-b border-brand-edge bg-white text-brand-black">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3 sm:px-6">
          <a className={linkClass} href={storefront}>
            <img className="h-12 w-36 object-contain object-left" src={logo} alt="Closets Warehouse" />
          </a>
          <nav aria-label="Storefront">
            <StorefrontLinks links={shopLinks} className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold" />
            {recentPlan && <a className={`${linkClass} mt-2 inline-block text-sm font-semibold`} href={`${storefront}/apps/closet-quotes/recent-plans`}>Recent Plans</a>}
          </nav>
        </div>
      </header>}
      {children}
      <footer data-planner-site-footer className="print-hide border-t border-brand-edge bg-brand-panel text-brand-black">
        <div className="mx-auto grid max-w-7xl gap-7 px-4 py-8 text-sm sm:grid-cols-3 sm:px-6">
          <div>
            <h2 className="mb-3 font-bold">Closets Warehouse</h2>
            <address className="space-y-2 not-italic">
              <p>3413 SW 14th Street, Suite 2<br />Deerfield Beach, FL 33442</p>
              <p>Call or text <a className={linkClass} href="tel:+19542478032" target={footerLinkTarget}>(954) 247-8032</a></p>
            </address>
          </div>
          <nav aria-label="Resources">
            <h2 className="mb-3 font-bold">Resources</h2>
            <StorefrontLinks links={resources} className="space-y-2" target={footerLinkTarget} />
          </nav>
          <nav aria-label="Terms and Policies">
            <h2 className="mb-3 font-bold">Terms and Policies</h2>
            <StorefrontLinks links={policies} className="space-y-2" target={footerLinkTarget} />
          </nav>
        </div>
      </footer>
    </>
  );
}
