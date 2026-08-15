export interface TourStep {
	selector: string;
	title: string;
	text: string;
	placement: 'top' | 'bottom';
	hue: number;
	sticky?: boolean;
	extraRings?: string[];
}

export interface TourHooks {
	openMenu?: () => void;
	closeMenu?: () => void;
}

export class GuidedTour {
	private containerEl: HTMLElement;
	private steps: TourStep[];
	private hooks: TourHooks;
	private scrollTargets: boolean;
	private overlayEl!: HTMLElement;
	private uiEl!: HTMLElement;
	private ringEl!: HTMLElement;
	private bubbleEl!: HTMLElement;
	private stepBadgeEl!: HTMLElement;
	private titleEl!: HTMLElement;
	private textEl!: HTMLElement;
	private dotsEl!: HTMLElement;
	private prevBtn!: HTMLButtonElement;
	private nextBtn!: HTMLButtonElement;
	private index = 0;
	private onDone?: () => void;
	private targetEl: HTMLElement | null = null;
	private targetClickHandler?: (ev: MouseEvent) => void;
	private extraRings: Array<{ ring: HTMLElement; target: HTMLElement }> = [];
	private cleanup: Array<() => void> = [];
	private finishing = false;
	private positionClassAdded = false;

	constructor(
		containerEl: HTMLElement,
		steps: TourStep[],
		hooks?: TourHooks,
		scrollTargets = false,
	) {
		this.containerEl = containerEl;
		this.steps = steps;
		this.hooks = hooks ?? {};
		this.scrollTargets = scrollTargets;
	}

	run(onDone: () => void) {
		this.onDone = onDone;
		if (this.steps.length === 0) {
			onDone();
			return;
		}
		this.buildUi();
		this.showStep(0);
	}

	destroy() {
		this.clearTarget();
		for (const fn of this.cleanup) fn();
		this.cleanup = [];
		this.overlayEl?.remove();
		this.uiEl?.remove();
		if (this.positionClassAdded) {
			this.containerEl.toggleClass('gl-tour-relative', false);
			this.positionClassAdded = false;
		}
		this.onDone = undefined;
	}

	reposition() {
		if (this.targetEl) this.positionOn(this.targetEl);
		this.repositionExtraRings();
	}

	private buildUi() {
		const computed = getComputedStyle(this.containerEl);
		if (computed.position === 'static') {
			this.containerEl.toggleClass('gl-tour-relative', true);
			this.positionClassAdded = true;
		}

		this.overlayEl = this.containerEl.createDiv({ cls: 'gl-onboard' });
		this.uiEl = this.containerEl.createDiv({ cls: 'gl-onboard-ui' });
		this.ringEl = this.uiEl.createDiv({ cls: 'gl-onboard-ring' });

		this.bubbleEl = this.uiEl.createDiv({ cls: 'gl-onboard-bubble' });
		const header = this.bubbleEl.createDiv({ cls: 'gl-onboard-header' });
		this.stepBadgeEl = header.createDiv({ cls: 'gl-onboard-badge' });
		this.titleEl = header.createDiv({ cls: 'gl-onboard-title' });
		this.textEl = this.bubbleEl.createDiv({ cls: 'gl-onboard-text' });

		const actions = this.bubbleEl.createDiv({ cls: 'gl-onboard-actions' });
		this.prevBtn = actions.createEl('button', {
			cls: 'gl-onboard-prev is-hidden',
			attr: { type: 'button' },
			text: 'Back',
		});
		const skipBtn = actions.createEl('button', {
			cls: 'gl-onboard-skip',
			attr: { type: 'button' },
			text: 'Skip',
		});
		this.dotsEl = actions.createDiv({ cls: 'gl-onboard-dots' });
		this.nextBtn = actions.createEl('button', {
			cls: 'gl-onboard-next',
			attr: { type: 'button' },
		});

		this.prevBtn.addEventListener('click', () => this.prev());
		skipBtn.addEventListener('click', () => this.finish());
		this.nextBtn.addEventListener('click', () => this.next());
	}

	private showStep(i: number) {
		this.clearTarget();
		this.index = i;
		const step = this.steps[i];
		if (!step) return;

		this.uiEl.style.setProperty('--gl-step-hue', String(step.hue));

		const isMenuStep = step.selector.startsWith('.gl-picker-menu');
		if (isMenuStep) {
			this.hooks.openMenu?.();
		} else {
			this.hooks.closeMenu?.();
		}

		const target = this.containerEl.querySelector<HTMLElement>(step.selector);
		if (!target) {
			window.setTimeout(() => this.next(), 50);
			return;
		}
		this.targetEl = target;
		target.toggleClass('gl-onboard-target', true);
		if (!step.sticky) {
			this.targetClickHandler = () => this.next();
			target.addEventListener('click', this.targetClickHandler);
		}
		if (this.scrollTargets) {
			target.scrollIntoView({ block: 'center' });
		}
		this.positionOn(target);
		this.positionExtraRings();
		if (isMenuStep || this.scrollTargets) {
			const pinnedTarget = target;
			window.setTimeout(() => {
				if (this.targetEl === pinnedTarget) {
					this.positionOn(pinnedTarget);
					this.repositionExtraRings();
				}
			}, 160);
		}

		this.stepBadgeEl.setText(`${i + 1}`);
		this.titleEl.setText(step.title);
		this.textEl.setText(step.text);
		this.prevBtn.toggleClass('is-hidden', i === 0);
		this.nextBtn.setText(
			step.sticky
				? 'Got it'
				: i === this.steps.length - 1
					? 'Done'
					: 'Next',
		);
		this.renderDots(i);

		this.bubbleEl.toggleClass('gl-onboard-pop', true);
		window.setTimeout(
			() => this.bubbleEl.toggleClass('gl-onboard-pop', false),
			220,
		);
	}

	private renderDots(current: number) {
		this.dotsEl.empty();
		this.steps.forEach((_, i) => {
			this.dotsEl.createSpan({
				cls: `gl-onboard-dot${i === current ? ' is-active' : ''}`,
			});
		});
	}

	private positionRingOn(ringEl: HTMLElement, target: HTMLElement) {
		const containerRect = this.containerEl.getBoundingClientRect();
		const rect = target.getBoundingClientRect();
		const rel = {
			left: rect.left - containerRect.left,
			top: rect.top - containerRect.top,
			width: rect.width,
			height: rect.height,
		};
		const ring = 6;
		const ringW = Math.max(rel.width + ring * 2, 28);
		const ringH = Math.max(rel.height + ring * 2, 28);
		ringEl.style.left = `${rel.left + rel.width / 2 - ringW / 2}px`;
		ringEl.style.top = `${rel.top + rel.height / 2 - ringH / 2}px`;
		ringEl.style.width = `${ringW}px`;
		ringEl.style.height = `${ringH}px`;
	}

	private positionExtraRings() {
		this.clearExtraRings();
		const step = this.steps[this.index];
		if (!step) return;
		for (const selector of step.extraRings ?? []) {
			const target = this.containerEl.querySelector<HTMLElement>(selector);
			if (!target) continue;
			const ring = this.uiEl.createDiv({
				cls: 'gl-onboard-ring gl-onboard-ring-secondary',
			});
			this.extraRings.push({ ring, target });
			this.positionRingOn(ring, target);
		}
	}

	private repositionExtraRings() {
		for (const { ring, target } of this.extraRings) {
			this.positionRingOn(ring, target);
		}
	}

	private clearExtraRings() {
		for (const { ring } of this.extraRings) ring.remove();
		this.extraRings = [];
	}

	private positionOn(target: HTMLElement) {
		this.positionRingOn(this.ringEl, target);

		const containerRect = this.containerEl.getBoundingClientRect();
		const rect = target.getBoundingClientRect();
		const rel = {
			left: rect.left - containerRect.left,
			top: rect.top - containerRect.top,
			width: rect.width,
			height: rect.height,
		};

		const step = this.steps[this.index];
		if (!step) return;
		const bubbleW = Math.min(
			this.bubbleEl.offsetWidth,
			this.containerEl.offsetWidth - 24,
		);
		const bubbleH = this.bubbleEl.offsetHeight;
		let left: number;
		let top: number;

		if (step.placement === 'top') {
			left = rel.left + rel.width / 2 - bubbleW / 2;
			top = rel.top - bubbleH - 14;
		} else {
			left = rel.left + rel.width / 2 - bubbleW / 2;
			top = rel.top + rel.height + 14;
		}
		left = clamp(left, 8, this.containerEl.offsetWidth - bubbleW - 8);
		top = clamp(top, 8, this.containerEl.offsetHeight - bubbleH - 8);

		this.bubbleEl.style.left = `${left}px`;
		this.bubbleEl.style.top = `${top}px`;
		this.bubbleEl.toggleClass(
			'gl-onboard-arrow-top',
			step.placement === 'top',
		);
		this.bubbleEl.toggleClass(
			'gl-onboard-arrow-bottom',
			step.placement === 'bottom',
		);
	}

	private next() {
		if (this.index >= this.steps.length - 1) {
			this.finish();
			return;
		}
		this.showStep(this.index + 1);
	}

	private prev() {
		if (this.index <= 0) return;
		this.showStep(this.index - 1);
	}

	private finish() {
		if (this.finishing) return;
		this.finishing = true;
		const done = this.onDone;
		this.hooks.closeMenu?.();
		this.destroy();
		done?.();
	}

	private clearTarget() {
		if (this.targetEl) {
			if (this.targetClickHandler) {
				this.targetEl.removeEventListener('click', this.targetClickHandler);
				this.targetClickHandler = undefined;
			}
			this.targetEl.toggleClass('gl-onboard-target', false);
		}
		this.targetEl = null;
		this.clearExtraRings();
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
