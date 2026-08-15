interface OnboardingStep {
	selector: string;
	text: string;
	placement: 'top' | 'bottom';
	hue: number;
	sticky?: boolean;
}

export interface OnboardingHooks {
	openMenu: () => void;
	closeMenu: () => void;
}

export class PickerOnboarding {
	private containerEl: HTMLElement;
	private hooks: OnboardingHooks;
	private overlayEl!: HTMLElement;
	private uiEl!: HTMLElement;
	private ringEl!: HTMLElement;
	private bubbleEl!: HTMLElement;
	private stepBadgeEl!: HTMLElement;
	private textEl!: HTMLElement;
	private dotsEl!: HTMLElement;
	private nextBtn!: HTMLButtonElement;
	private steps: OnboardingStep[] = [];
	private index = 0;
	private onDone?: () => void;
	private targetEl: HTMLElement | null = null;
	private targetClickHandler?: (ev: MouseEvent) => void;
	private cleanup: Array<() => void> = [];
	private finishing = false;

	constructor(containerEl: HTMLElement, hooks: OnboardingHooks) {
		this.containerEl = containerEl;
		this.hooks = hooks;
	}

	run(onDone: () => void) {
		this.onDone = onDone;
		this.buildSteps();
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
		this.onDone = undefined;
	}

	reposition() {
		if (this.targetEl) this.positionOn(this.targetEl);
	}

	private buildSteps() {
		this.steps = [
			{
				selector: '.gl-picker-search input',
				text: 'Search emojis and stickers by name as you type.',
				placement: 'bottom',
				hue: 205,
			},
			{
				selector: '.gl-picker-tabs',
				text: 'Switch between Emojis and Stickers.',
				placement: 'bottom',
				hue: 265,
			},
			{
				selector: '.gl-picker-menu',
				text: 'The ⋮ menu holds the Move and Resize options.',
				placement: 'top',
				hue: 32,
			},
			{
				selector: '.gl-picker-menu-item.gl-move',
				text: 'Hold Move and drag to place the picker anywhere on screen.',
				placement: 'top',
				hue: 130,
				sticky: true,
			},
			{
				selector: '.gl-picker-menu-item.gl-resize-item',
				text: 'Toggle Resize on — a handle appears on the corner so you can drag to resize.',
				placement: 'top',
				hue: 45,
				sticky: true,
			},
			{
				selector: '.gl-picker-resize',
				text: 'Drag the corner to resize the picker. Double-click the corner to reset.',
				placement: 'top',
				hue: 285,
				sticky: true,
			},
		];
	}

	private buildUi() {
		this.overlayEl = this.containerEl.createDiv({ cls: 'gl-onboard' });
		this.uiEl = this.containerEl.createDiv({ cls: 'gl-onboard-ui' });
		this.ringEl = this.uiEl.createDiv({ cls: 'gl-onboard-ring' });

		this.bubbleEl = this.uiEl.createDiv({ cls: 'gl-onboard-bubble' });
		const header = this.bubbleEl.createDiv({ cls: 'gl-onboard-header' });
		this.stepBadgeEl = header.createDiv({ cls: 'gl-onboard-badge' });
		header.createSpan({ cls: 'gl-onboard-kicker', text: 'Quick tour' });
		this.textEl = this.bubbleEl.createDiv({ cls: 'gl-onboard-text' });

		const actions = this.bubbleEl.createDiv({ cls: 'gl-onboard-actions' });
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

		skipBtn.addEventListener('click', () => this.finish());
		this.nextBtn.addEventListener('click', () => this.next());
	}

	private showStep(i: number) {
		this.clearTarget();
		this.index = i;
		const step = this.steps[i];
		if (!step) return;

		this.uiEl.style.setProperty('--gl-step-hue', String(step.hue));

		if (step.selector.startsWith('.gl-picker-menu')) {
			this.hooks.openMenu();
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
		this.positionOn(target);

		this.stepBadgeEl.setText(`${i + 1}`);
		this.textEl.setText(step.text);
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

	private positionOn(target: HTMLElement) {
		const containerRect = this.containerEl.getBoundingClientRect();
		const rect = target.getBoundingClientRect();
		const rel = {
			left: rect.left - containerRect.left,
			top: rect.top - containerRect.top,
			width: rect.width,
			height: rect.height,
		};

		const ring = 6;
		this.ringEl.style.left = `${rel.left - ring}px`;
		this.ringEl.style.top = `${rel.top - ring}px`;
		this.ringEl.style.width = `${rel.width + ring * 2}px`;
		this.ringEl.style.height = `${rel.height + ring * 2}px`;

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

	private finish() {
		if (this.finishing) return;
		this.finishing = true;
		const done = this.onDone;
		this.hooks.closeMenu();
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
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
