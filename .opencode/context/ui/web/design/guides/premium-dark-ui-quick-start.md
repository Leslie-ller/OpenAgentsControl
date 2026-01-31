# Premium Dark UI - Quick Start Guide

**Goal**: Create a sophisticated, modern dark website with glassmorphism and depth.

**Time to implement**: 30-60 minutes

---

## 1. COLOR PALETTE (Copy This)

```css
/* Backgrounds */
--bg-deep-dark: #0a0f0d;      /* Main background */
--bg-black: #000000;           /* Alternate sections */

/* Text */
--text-heading: #ffffff;       /* Headings */
--text-body: #cbd5e1;          /* Body (slate-300) */
--text-muted: #94a3b8;         /* Muted (slate-400) */

/* Accent */
--accent: #80cca5;             /* Green - CTAs, links, highlights */
--accent-hover: #6bb890;       /* Hover state */

/* Glass */
--glass-bg: rgba(255, 255, 255, 0.02);
--glass-border: rgba(255, 255, 255, 0.1);
```

**Rule**: Use ONLY these colors. No exceptions.

---

## 2. CORE COMPONENTS (4 Building Blocks)

### A. Section Wrapper

```tsx
// PremiumSection.tsx
export function PremiumSection({ children, withGlow = true }) {
  return (
    <section className="relative py-24 px-4 bg-[#0a0f0d] overflow-hidden">
      {withGlow && (
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(128, 204, 165, 0.15) 0%, transparent 70%)',
            opacity: 0.15
          }}
        />
      )}
      <div className="max-w-7xl mx-auto relative z-10">
        {children}
      </div>
    </section>
  )
}
```

### B. Glass Card

```tsx
// PremiumCard.tsx
export function PremiumCard({ children, className = "" }) {
  return (
    <div className={`
      p-8 rounded-2xl 
      bg-white/[0.02] 
      border border-white/10 
      backdrop-blur-xl 
      shadow-2xl 
      transition-all duration-300
      hover:bg-white/[0.04] 
      hover:border-[#80cca5]/30
      ${className}
    `}>
      {children}
    </div>
  )
}
```

### C. Heading

```tsx
// PremiumHeading.tsx
export function PremiumHeading({ children, accent, as: Tag = 'h2' }) {
  return (
    <Tag className="text-3xl md:text-5xl font-bold text-white mb-6">
      {children}
      {accent && <span className="text-[#80cca5]"> {accent}</span>}
    </Tag>
  )
}
```

### D. Radial Glow

```tsx
// RadialGlow.tsx
export function RadialGlow({ className = "" }) {
  return (
    <div 
      className={`absolute -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none ${className}`}
      style={{
        background: 'radial-gradient(circle, rgba(128, 204, 165, 0.15) 0%, transparent 70%)',
        opacity: 0.15
      }}
    />
  )
}
```

---

## 3. SPACING SYSTEM

```css
/* Use these values ONLY */
py-4   /* 16px - Small spacing */
py-8   /* 32px - Medium spacing */
py-12  /* 48px - Large spacing */
py-24  /* 96px - Section spacing */

px-4   /* 16px - Mobile padding */
px-8   /* 32px - Card padding */
px-12  /* 48px - Large card padding */

gap-4  /* 16px - Small gaps */
gap-8  /* 32px - Medium gaps */
gap-12 /* 48px - Large gaps */

mb-4   /* 16px - Small margin bottom */
mb-6   /* 24px - Medium margin bottom */
mb-8   /* 32px - Large margin bottom */
mb-16  /* 64px - Section margin bottom */
```

**Rule**: Stick to multiples of 4 (4, 8, 12, 16, 24, 32, 48, 64, 96).

---

## 4. TYPOGRAPHY SCALE

```tsx
// Page Title (H1)
<h1 className="text-4xl md:text-6xl font-bold text-white mb-8">
  Page Title
</h1>

// Section Title (H2)
<h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
  Section Title <span className="text-[#80cca5]">Accent</span>
</h2>

// Subsection (H3)
<h3 className="text-2xl md:text-4xl font-bold text-white mb-4">
  Subsection
</h3>

// Body Text
<p className="text-lg text-slate-300 mb-4">
  Body text goes here
</p>

// Muted Text
<p className="text-sm text-slate-400">
  Secondary information
</p>

// Accent Text
<p className="text-lg font-semibold text-[#80cca5]">
  Call to action text
</p>
```

---

## 5. BUTTONS & LINKS

```tsx
// Primary CTA Button
<button className="
  px-8 py-4 
  rounded-full 
  bg-[#80cca5] 
  hover:bg-[#6bb890] 
  text-white 
  font-semibold 
  transition-all 
  shadow-lg 
  hover:shadow-xl
">
  Primary Action
</button>

// Secondary Button
<button className="
  px-6 py-3 
  rounded-full 
  bg-white/[0.02] 
  border border-white/10 
  hover:border-[#80cca5]/30 
  text-white 
  font-medium 
  transition-all
">
  Secondary Action
</button>

// Link
<a href="#" className="text-[#80cca5] hover:text-[#6bb890] transition-colors">
  Link Text
</a>
```

---

## 6. FORM INPUTS

```tsx
// Text Input
<input 
  type="text"
  className="
    w-full 
    px-4 py-3 
    rounded-lg 
    border border-[#80cca5]/20 
    bg-slate-900/50 
    text-white 
    placeholder:text-slate-500 
    focus:ring-2 
    focus:ring-[#80cca5] 
    focus:border-transparent
  "
  placeholder="Enter text"
/>

// Textarea
<textarea 
  className="
    w-full 
    px-4 py-3 
    rounded-lg 
    border border-[#80cca5]/20 
    bg-slate-900/50 
    text-white 
    placeholder:text-slate-500 
    focus:ring-2 
    focus:ring-[#80cca5] 
    focus:border-transparent 
    resize-none
  "
  rows={4}
/>

// Label
<label className="text-slate-200 font-medium mb-2 block">
  Field Label
</label>
```

---

## 7. COMMON LAYOUTS

### Hero Section

```tsx
<PremiumSection>
  <div className="max-w-4xl mx-auto text-center">
    <PremiumHeading as="h1" accent="AI">
      Build Production
    </PremiumHeading>
    <p className="text-xl text-slate-300 mb-8">
      Your subtitle goes here
    </p>
    <button className="px-8 py-4 rounded-full bg-[#80cca5] hover:bg-[#6bb890] text-white font-semibold transition-all shadow-lg">
      Get Started
    </button>
  </div>
</PremiumSection>
```

### Feature Grid

```tsx
<PremiumSection>
  <div className="text-center mb-16">
    <PremiumHeading accent="Features">
      Powerful
    </PremiumHeading>
  </div>
  <div className="grid md:grid-cols-3 gap-8">
    {features.map((feature) => (
      <PremiumCard key={feature.id}>
        <Icon className="size-12 text-[#80cca5] mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">
          {feature.title}
        </h3>
        <p className="text-slate-300">
          {feature.description}
        </p>
      </PremiumCard>
    ))}
  </div>
</PremiumSection>
```

### CTA Section

```tsx
<PremiumSection>
  <div className="max-w-3xl mx-auto">
    <div className="text-center mb-12">
      <PremiumHeading accent="Started">
        Get
      </PremiumHeading>
      <p className="text-xl text-slate-300">
        Join thousands of users
      </p>
    </div>
    <PremiumCard className="p-8 md:p-12">
      <form className="space-y-6">
        <input 
          type="email"
          placeholder="you@example.com"
          className="w-full px-4 py-3 rounded-lg border border-[#80cca5]/20 bg-slate-900/50 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-[#80cca5] focus:border-transparent"
        />
        <button className="w-full px-8 py-4 rounded-full bg-[#80cca5] hover:bg-[#6bb890] text-white font-semibold transition-all">
          Sign Up
        </button>
      </form>
    </PremiumCard>
  </div>
</PremiumSection>
```

---

## 8. GLASSMORPHISM RULES

✅ **DO**:
- Use `bg-white/[0.02]` for card backgrounds
- Add `backdrop-blur-xl` for blur effect
- Use `border-white/10` for subtle borders
- Keep opacity LOW (0.02 to 0.04)
- Layer multiple glass surfaces

❌ **DON'T**:
- Use high opacity (breaks glass effect)
- Skip backdrop blur (looks flat)
- Use on light backgrounds (invisible)
- Overuse (reserve for cards/panels)

**Example**:
```tsx
<div className="bg-white/[0.02] border border-white/10 backdrop-blur-xl">
  Glass content
</div>
```

---

## 9. RADIAL GLOW USAGE

### When to Use:
- ✅ Hero sections (large, centered)
- ✅ Important CTAs (behind forms)
- ✅ Section breaks (corner glows)
- ❌ Every section (overwhelming)
- ❌ Small components (too subtle)

### Sizes:
- **Small**: 400px (subtle accent)
- **Medium**: 600px (default)
- **Large**: 800px (hero sections)

### Positioning:
```tsx
// Centered
<RadialGlow className="top-1/2 left-1/2" />

// Top-left
<RadialGlow className="top-0 left-0" />

// Bottom-right
<RadialGlow className="bottom-0 right-0" />
```

---

## 10. RESPONSIVE DESIGN

```tsx
// Mobile: Stack, Desktop: Grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
  {/* Items */}
</div>

// Mobile: Full width, Desktop: Constrained
<div className="w-full lg:max-w-4xl mx-auto">
  {/* Content */}
</div>

// Mobile: Small text, Desktop: Large text
<h2 className="text-3xl md:text-5xl">
  Responsive Heading
</h2>

// Mobile: Center, Desktop: Left
<div className="text-center lg:text-left">
  {/* Content */}
</div>
```

**Breakpoints**:
- `sm`: 640px (tablets)
- `md`: 768px (tablets/small laptops)
- `lg`: 1024px (laptops)
- `xl`: 1280px (desktops)

---

## 11. ANIMATIONS

### Hover Effects

```tsx
// Card hover
<div className="transition-all duration-300 hover:scale-[1.02]">
  Card content
</div>

// Button hover
<button className="transition-colors duration-200 hover:bg-[#6bb890]">
  Button
</button>

// Image hover
<img className="transition-transform duration-700 hover:scale-105" />
```

### Scroll Reveal (Optional)

```tsx
// Install: npm install react-intersection-observer
import { useInView } from 'react-intersection-observer'

function Component() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 })
  
  return (
    <div 
      ref={ref}
      className={`transition-all duration-700 ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      Content
    </div>
  )
}
```

---

## 12. ACCESSIBILITY CHECKLIST

✅ **Color Contrast**:
- White on `#0a0f0d`: 21:1 (AAA) ✅
- `slate-300` on `#0a0f0d`: 12.6:1 (AAA) ✅
- `#80cca5` on `#0a0f0d`: 7.8:1 (AAA) ✅

✅ **Focus States**:
```tsx
<button className="focus:ring-2 focus:ring-[#80cca5] focus:outline-none">
  Button
</button>
```

✅ **Semantic HTML**:
```tsx
<nav>
  <ul>
    <li><a href="#">Link</a></li>
  </ul>
</nav>
```

✅ **Alt Text**:
```tsx
<img src="..." alt="Descriptive text" />
```

---

## 13. QUICK WINS (Instant Premium Feel)

1. **Replace all backgrounds** with `#0a0f0d`
2. **Use only white and slate-300** for text
3. **Make all CTAs** `#80cca5` green
4. **Add backdrop-blur-xl** to all cards
5. **Use rounded-2xl** for cards, `rounded-full` for buttons
6. **Add one radial glow** to hero section
7. **Increase padding** (py-24 for sections, p-8 for cards)
8. **Add hover effects** to all interactive elements

---

## 14. COMMON MISTAKES TO AVOID

❌ **Don't**:
- Use light backgrounds (`bg-white`, `bg-slate-100`)
- Use `dark:` variants (this is dark-only)
- Mix multiple accent colors
- Use high-opacity glass (`bg-white/50`)
- Skip backdrop blur on glass elements
- Use small padding (looks cramped)
- Forget hover states
- Ignore mobile layout

✅ **Do**:
- Stick to the color palette
- Use consistent spacing (multiples of 4)
- Add subtle animations
- Test on mobile first
- Keep glass opacity low
- Use radial glows sparingly
- Maintain high contrast for text

---

## 15. COPY-PASTE STARTER TEMPLATE

```tsx
import React from 'react'

// 1. Copy the 4 core components (Section A-D above)
// 2. Use this page structure:
export default function Page() {
  return (
    <div className="min-h-screen bg-[#0a0f0d]">
      {/* Hero */}
      <PremiumSection>
        <div className="max-w-4xl mx-auto text-center">
          <PremiumHeading as="h1" accent="Premium">
            Your
          </PremiumHeading>
          <p className="text-xl text-slate-300 mb-8">
            Subtitle goes here
          </p>
          <button className="px-8 py-4 rounded-full bg-[#80cca5] hover:bg-[#6bb890] text-white font-semibold transition-all shadow-lg">
            Get Started
          </button>
        </div>
      </PremiumSection>

      {/* Features */}
      <PremiumSection>
        <div className="text-center mb-16">
          <PremiumHeading accent="Features">
            Amazing
          </PremiumHeading>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <PremiumCard>
            <h3 className="text-xl font-bold text-white mb-2">Feature 1</h3>
            <p className="text-slate-300">Description</p>
          </PremiumCard>
          <PremiumCard>
            <h3 className="text-xl font-bold text-white mb-2">Feature 2</h3>
            <p className="text-slate-300">Description</p>
          </PremiumCard>
          <PremiumCard>
            <h3 className="text-xl font-bold text-white mb-2">Feature 3</h3>
            <p className="text-slate-300">Description</p>
          </PremiumCard>
        </div>
      </PremiumSection>

      {/* CTA */}
      <PremiumSection>
        <div className="max-w-3xl mx-auto text-center">
          <PremiumHeading accent="Started">
            Get
          </PremiumHeading>
          <PremiumCard className="p-8 md:p-12">
            <form className="space-y-6">
              <input 
                type="email"
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-lg border border-[#80cca5]/20 bg-slate-900/50 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-[#80cca5] focus:border-transparent"
              />
              <button className="w-full px-8 py-4 rounded-full bg-[#80cca5] hover:bg-[#6bb890] text-white font-semibold transition-all">
                Sign Up
              </button>
            </form>
          </PremiumCard>
        </div>
      </PremiumSection>
    </div>
  )
}
```

---

## 16. FINAL CHECKLIST

Before launching, verify:

- [ ] All backgrounds are `#0a0f0d` or `black`
- [ ] All headings are `text-white`
- [ ] All body text is `text-slate-300`
- [ ] All CTAs are `#80cca5` green
- [ ] All cards have `backdrop-blur-xl`
- [ ] All cards use `bg-white/[0.02]`
- [ ] All buttons have hover states
- [ ] All forms have focus states
- [ ] Spacing uses multiples of 4
- [ ] Mobile layout tested
- [ ] Radial glows are subtle (not overwhelming)
- [ ] No light mode variants (`dark:`)
- [ ] Contrast ratios meet WCAG AA minimum

---

## DONE! 🎉

You now have everything needed to create a premium dark UI.

**Time to premium**: 30-60 minutes
**Maintenance**: Easy (4 components, 1 color palette)
**Scalability**: High (reusable components)

**Questions?** Reference the full guide: `.opencode/context/ui/web/design/guides/premium-dark-ui-system.md`
