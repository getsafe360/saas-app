# WP Health & Security AI Engine

This is a **comprehensive, opinionated, engineering‑grade list** of our modern WordPress diagnostic check.

I’m grouping it into **Security**, **Performance**, **Stability**, **SEO/UX**, and **Hosting Environment** so you can turn this into a structured insights dashboard.


# **WordPress Insights: The Complete Checklist**

## **1. Security (Critical Layer)**

These are the highest‑impact checks — the ones that prevent hacks, spam, and data leaks.

### **Authentication & Access**

- **Login page protected** (✔ we have this) 

- **User enumeration blocked** (✔) 

- **XML‑RPC disabled or restricted** (✔) 

- **REST API exposure** 

  - Check if `/wp-json/wp/v2/users` leaks usernames 

  - Check if sensitive endpoints are open 

- **Admin username not “admin”** 

- **Number of admin users** 

  - Flag if \>1 unless justified 

- **Weak password detection** (if possible via metadata) 

- **2FA enabled** (for supported plugins) 

### **Core & File Integrity**

- **WordPress core version** 

  - Outdated? Minor/major? 

- **File integrity check** 

  - Modified core files 

  - Suspicious files in `/wp-admin/`, `/wp-includes/`, `/wp-content/uploads/` 

- **Directory listing disabled** 

- **wp-config.php security** 

  - File permissions 

  - Keys & salts present 

  - DB prefix not `wp\_` 

  - Debug mode off (✔) 

### **Plugins & Themes**

- **Plugin count** (✔ you started this) 

  - Outdated 

  - Abandoned 

  - Known vulnerabilities 

  - Premium plugins without license updates 

- **Theme status** 

  - Active theme 

  - Outdated 

  - Child theme present 

  - Unused themes installed (attack surface) 

### **Server & Transport Security**

- **HTTPS enforced** 

- **HSTS enabled** 

- **TLS version** 

- **Mixed content detection** 

### **Malware & Spam Indicators**

- Suspicious cron jobs 

- Unexpected admin accounts 

- Hidden iframes / injected JS 

- Modified `.htaccess` rules 

- Spam comments enabled 


# **2. Performance & Speed Metrics**

### **Server-Level**

- PHP version (7.4, 8.0, 8.1, 8.2…) 

- PHP memory limit 

- Max execution time 

- OPcache enabled 

- Database server version (MySQL/MariaDB) 

### **WordPress-Level**

- Object caching enabled (Redis/Memcached) 

- Page caching enabled 

- Transients cleanup 

- Autoloaded options size 

- Cron system health 

- Heartbeat API throttled 

### **Frontend Performance**

- Largest Contentful Paint (LCP) 

- Total Blocking Time (TBT) 

- Cumulative Layout Shift (CLS) 

- Render‑blocking JS/CSS 

- Image optimization (WebP, lazyload) 

- Unused CSS/JS detection 

- Plugin bloat (plugins loading assets everywhere) 


# **3. Stability & Maintainability**

### **Database Health**

- Database size 

- Largest tables 

- Orphaned tables from removed plugins 

- Autoloaded options \> 1 MB (major slowdown) 

- Postmeta bloat 

- Revisions count 

### **Cron & Scheduled Tasks**

- Stuck cron jobs 

- Overloaded cron queue 

- Disabled WP cron (and missing real cron) 

### **Error Logging**

- PHP error log size 

- Fatal errors detected 

- Deprecated functions used 

- WP\_DEBUG\_LOG enabled (should be off in production) 


# **4. SEO, UX & Content Quality**

### **Technical SEO**

- Sitemap accessible 

- robots.txt valid 

- Canonical tags present 

- Schema markup detected 

- Permalink structure 

- 404 error rate 

- Redirect loops 

### **Content & UX**

- Broken links 

- Missing alt tags 

- Mobile responsiveness 

- Accessibility basics (contrast, ARIA roles) 


# **5. Hosting Environment & Infrastructure**

### **Server**

- CPU/RAM usage 

- Disk space 

- Inode usage 

- PHP-FPM status 

- Slow queries (if detectable) 

### **CDN & Edge**

- CDN enabled (Cloudflare, Bunny, etc.) 

- Cache HIT ratio 

- Firewall rules active 


# **6. Bonus: “Red Flag” Indicators for a Compromised Site**

These are high‑value signals for our Insights engine:

- Unknown admin users 

- Recently modified core files 

- Base64‑encoded PHP in uploads 

- Suspicious scheduled tasks 

- Plugins installed but not visible in admin 

- Hidden `.php` files in `/uploads/` 

- Outbound spam email spikes 

- Traffic anomalies (bot floods) 


# **7. How to Present This in GetSafe360 AI**

You can turn this into a **3‑layer scoring system**:

### **Security Score (0–100)**

Weighted by severity (admin username = low, outdated core = high)

### **Performance Score (0–100)**

Based on server + frontend + database metrics

### **Stability Score (0–100)**

Cron, DB health, error logs, plugin quality

Then provide:

- **Fix priority list** 

- **Auto‑generated remediation steps** 

- **Risk level** (Low / Medium / High) 

- **Estimated impact** (Speed, security, SEO) 
