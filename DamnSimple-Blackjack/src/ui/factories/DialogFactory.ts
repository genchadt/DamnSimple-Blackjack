// src/ui/factories/DialogFactory.ts
import { AdvancedDynamicTexture, Button, Rectangle, StackPanel, TextBlock, Control } from "@babylonjs/gui";
import { DebugManager } from "../../debug/DebugManager";
import { BlackjackGame, PlayerHandInfo } from "../../game/BlackjackGame";
import { Card } from "../../game/Card";
import { GameResult } from "../../game/GameState";
import { ScoreCalculator } from "../../game/ScoreCalculator";

/**
 * Injects shared CSS styles for all dynamic HTML dialogs into the document head.
 * Ensures the styles are only added once.
 */
function injectDialogStyles(): void {
    if (document.getElementById('blackjack-dialog-styles')) {
        return;
    }
    const styleSheet = document.createElement("style");
    styleSheet.id = "blackjack-dialog-styles";
    styleSheet.innerText = `
        .bj-dialog-base {
            position: absolute;
            border: none;
            background-color: rgba(20, 20, 30, 0.8);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            z-index: 1002;
            font-family: Arial, sans-serif;
            font-size: 14px;
            color: white;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            display: none; /* Hidden by default */
        }
        .bj-dialog-draggable {
            cursor: move;
        }
        .bj-dialog-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            padding: 5px 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            background-color: rgba(30, 30, 40, 0.5);
            border-top-left-radius: 10px;
            border-top-right-radius: 10px;
            cursor: grab;
        }
        .bj-dialog-header:active {
            cursor: grabbing;
        }
        .bj-dialog-title {
            font-weight: bold;
            font-size: 16px;
            color: white;
        }
        .bj-dialog-close-button {
            padding: 0;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background-color: #f06060;
            color: white;
            border: 1px solid #d04040;
            font-size: 14px;
            line-height: 20px;
            text-align: center;
            cursor: pointer;
            font-weight: bold;
            flex-shrink: 0;
        }
        .bj-dialog-close-button:hover {
            background-color: #e04040;
        }
        .bj-dialog-content {
            padding: 15px;
            max-height: 450px;
            overflow-y: auto;
            overflow-x: hidden;
        }
        .debug-card-container {
            position: relative;
            width: 60px;
            height: 84px;
            display: inline-block;
        }
        .debug-card-container playing-card {
            width: 100%;
            height: 100%;
            border-radius: 3px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        }
        .debug-card-indicator {
            position: absolute;
            top: 2px;
            right: 2px;
            width: 18px;
            height: 18px;
            background-color: rgba(0, 0, 0, 0.6);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-family: 'Segoe UI Symbol', sans-serif;
            pointer-events: none;
            line-height: 1;
        }
        @keyframes green-flash { from { box-shadow: 0 0 8px 3px limegreen; } to { box-shadow: 0 1px 3px rgba(0,0,0,0.4); } }
        .card-dealt { animation: green-flash 0.5s ease-out; }
        @keyframes red-flash-and-fade { 0% { box-shadow: 0 0 8px 3px tomato; opacity: 1; } 70% { box-shadow: none; opacity: 1; } 100% { opacity: 0; transform: scale(0.9); } }
        .card-discarded .debug-card-container { animation: red-flash-and-fade 0.5s ease-out forwards; }
        .debug-header-nav button { padding: 2px 6px; margin-left: 5px; cursor: pointer; border: 1px solid #555; background-color: #eee; border-radius: 3px; }
        .debug-header-nav button:hover { background-color: #ddd; }
        .debug-menu-button-container { display: flex; flex-direction: column; gap: 8px; }
        .debug-menu-button { padding: 8px 12px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; text-align: left; font-size: 13px; width: 100%; box-sizing: border-box; }
        .debug-menu-button:hover { background-color: #45a049; }
        .debug-menu-separator { height: 1px; background-color: rgba(255, 255, 255, 0.2); margin: 8px 0; }
        .debug-menu-button-group { position: relative; }
        .debug-submenu { display: none; position: fixed; background-color: rgba(35, 35, 45, 0.95); min-width: 200px; box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.3); z-index: 1005; border: none; border-radius: 8px; padding: 8px 0; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
        .debug-submenu-button { color: white; padding: 8px 12px; text-decoration: none; display: block; text-align: left; background-color: transparent; border: none; width: 100%; font-size: 13px; cursor: pointer; }
        .debug-submenu-button:hover { background-color: rgba(255, 255, 255, 0.1); }
        .debug-prompt-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 1010; display: flex; align-items: center; justify-content: center; }
        .debug-prompt-dialog {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            /* background-color will be inherited from .bj-dialog-base */
            padding: 0; /* Header and content have their own padding */
            /* border-radius will be inherited from .bj-dialog-base (10px) */
            /* box-shadow will be inherited from .bj-dialog-base */
            min-width: 300px;
            max-width: 90%;
            z-index: 1011; /* Must be above overlay */
        }
        .debug-prompt-dialog p {
            margin: 0 0 15px 0;
            font-size: 16px;
            /* color will be inherited from .bj-dialog-base (white) */
        }
        .debug-prompt-dialog input[type="number"] {
            width: calc(100% - 22px);
            padding: 10px;
            margin-bottom: 20px;
            border: 1px solid rgba(255, 255, 255, 0.3); /* Dark theme border */
            border-radius: 4px;
            font-size: 16px;
            background-color: rgba(255, 255, 255, 0.1); /* Dark theme background */
            color: white; /* Dark theme text color */
        }
        .debug-prompt-buttons { display: flex; justify-content: flex-end; gap: 10px; }
        .debug-prompt-buttons button { padding: 10px 15px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold; }
        .debug-prompt-confirm { background-color: #4CAF50; color: white; }
        .debug-prompt-confirm:hover { background-color: #45a049; }
        .debug-prompt-cancel { background-color: #f44336; color: white; }
        .debug-prompt-cancel:hover { background-color: #d32f2f; }
        .debug-player-hand-section { border: 1px solid #777; padding: 5px; margin-bottom: 10px; border-radius: 4px; background-color: transparent; /* Was rgba(230,230,250,0.5) */ }
        .debug-player-hand-section.active-hand { border-color: limegreen; box-shadow: 0 0 5px limegreen; }
        
        .deck-inspector-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 8px;
            justify-items: center;
        }
        .deck-inspector-grid .debug-card-container {
            width: 50px;
            height: 70px;
        }

        /* Reduce top padding for debug hand display content */
        #blackjack-debug-hand-display .bj-dialog-content {
            padding-top: 5px; /* Was 15px by default from .bj-dialog-content */
        }

        /* Debug Menu Mica Effect - now redundant as we've moved styles to base dialog */
        #blackjack-debug-menu .debug-menu-button-container {
            padding: 0 5px 5px 5px;
        }
        
        /* Debug prompt dialog - specific overrides removed or adjusted for dark theme */
        /*
        .debug-prompt-dialog {
            background-color: #fff !important; // Removed
            color: #333 !important;           // Removed
        }
        .debug-prompt-dialog .bj-dialog-header {
            background-color: #f0f0f0 !important; // Removed
            border-bottom: 1px solid #ddd !important; // Removed
        }
        .debug-prompt-dialog .bj-dialog-title {
            color: #333 !important; // Removed
        }
        */
    `;
    document.head.appendChild(styleSheet);
}

/**
 * Base class for a draggable HTML dialog window that overlays the canvas.
 */
export abstract class DynamicDialog {
    protected dialogElement: HTMLElement;
    protected contentElement: HTMLElement;
    private isVisible: boolean = false;

    // Dragging properties
    private dragOffsetX: number = 0;
    private dragOffsetY: number = 0;
    private isDragging: boolean = false;

    constructor(id: string, title: string, initialPos: { left: string, top: string }, onClose?: () => void) {
        injectDialogStyles();

        this.dialogElement = document.createElement("div");
        this.dialogElement.id = id;
        this.dialogElement.className = "bj-dialog-base bj-dialog-draggable";
        this.dialogElement.style.left = initialPos.left;
        this.dialogElement.style.top = initialPos.top;

        const header = this.createHeader(title, onClose);
        this.dialogElement.appendChild(header);

        this.contentElement = document.createElement("div");
        this.contentElement.className = "bj-dialog-content";
        this.dialogElement.appendChild(this.contentElement);

        document.body.appendChild(this.dialogElement);
        this.makeDraggable(this.dialogElement, header);
    }

    private createHeader(title: string, onClose?: () => void): HTMLElement {
        const header = document.createElement('div');
        header.className = 'bj-dialog-header';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'bj-dialog-title';
        titleSpan.textContent = title;
        header.appendChild(titleSpan);

        if (onClose) {
            const closeButton = document.createElement('button');
            closeButton.className = 'bj-dialog-close-button';
            closeButton.innerHTML = '&#x2715;';
            closeButton.title = `Close ${title}`;
            closeButton.onclick = (e) => {
                e.stopPropagation();
                onClose();
            };
            header.appendChild(closeButton);
        }
        return header;
    }

    protected makeDraggable(element: HTMLElement, handle: HTMLElement): void {
        handle.onmousedown = (e) => {
            // Prevent dragging when clicking on buttons inside the handle
            if ((e.target as HTMLElement).closest('button')) {
                return;
            }

            this.onDragStart(e, element);
        };
    }

    protected onDragStart(e: MouseEvent, element: HTMLElement): void {
        this.isDragging = true;
        this.dragOffsetX = e.clientX - element.offsetLeft;
        this.dragOffsetY = e.clientY - element.offsetTop;

        document.onmousemove = this.dragElement.bind(this);
        document.onmouseup = this.stopDragElement.bind(this);
        e.preventDefault();
    }

    private dragElement(e: MouseEvent): void {
        if (this.isDragging) {
            e.preventDefault();
            let newLeft = e.clientX - this.dragOffsetX;
            let newTop = e.clientY - this.dragOffsetY;

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const elWidth = this.dialogElement.offsetWidth;
            const elHeight = this.dialogElement.offsetHeight;

            newLeft = Math.max(0, Math.min(newLeft, viewportWidth - elWidth));
            newTop = Math.max(0, Math.min(newTop, viewportHeight - elHeight));

            this.dialogElement.style.left = newLeft + 'px';
            this.dialogElement.style.top = newTop + 'px';
        }
    }

    private stopDragElement(): void {
        if (this.isDragging) {
            this.isDragging = false;
            document.onmousemove = null;
            document.onmouseup = null;
        }
    }

    public show(): void {
        this.dialogElement.style.display = 'block';
        this.isVisible = true;
    }

    public hide(): void {
        this.dialogElement.style.display = 'none';
        this.isVisible = false;
    }

    public toggle(visible?: boolean): void {
        const shouldBeVisible = typeof visible === 'undefined' ? !this.isVisible : visible;
        if (shouldBeVisible) {
            this.show();
        } else {
            this.hide();
        }
    }

    public dispose(): void {
        if (this.dialogElement) {
            this.dialogElement.remove();
        }
    }
}

/**
 * A dialog that displays the current hands and history for debugging.
 */
export class DebugHandDisplayDialog extends DynamicDialog {
    private blackjackGame: BlackjackGame;
    private handHistory: { playerHands: PlayerHandInfo[], dealer: Card[] }[] = [];
    private readonly MAX_HISTORY_ENTRIES = 10;
    private historyIndex: number = -1;
    private lastPlayerHands: PlayerHandInfo[] = [];
    private lastDealerHand: Card[] = [];

    constructor(blackjackGame: BlackjackGame, onToggle: () => void) {
        super("blackjack-debug-hand-display", "Current Hands", { left: '10px', top: '10px' }, onToggle);
        this.blackjackGame = blackjackGame;
        this.dialogElement.classList.remove("bj-dialog-draggable"); // The whole window is draggable
        this.dialogElement.classList.add("debug-window-base"); // Use old class for specific styling
        this.dialogElement.onmousedown = (e) => this.onDragStart(e, this.dialogElement);
    }

    public recordHandHistory(playerHands: PlayerHandInfo[], dealerHand: Card[]): void {
        if (playerHands.length > 0 || dealerHand.length > 0) {
            const clonedPlayerHands = playerHands.map(hand => ({ ...hand, cards: [...hand.cards] }));
            this.handHistory.unshift({ playerHands: clonedPlayerHands, dealer: [...dealerHand] });
            if (this.handHistory.length > this.MAX_HISTORY_ENTRIES) {
                this.handHistory.pop();
            }
        }
    }
    
    public resetHistory(): void {
        this.handHistory = [];
        this.historyIndex = -1;
        this.lastPlayerHands = [];
        this.lastDealerHand = [];
    }

    public update(): void {
        const isHistoryView = this.historyIndex > -1;
        let playerHands: PlayerHandInfo[];
        let dealerHand: Card[];
        let titleText: string;

        if (isHistoryView) {
            const historicalState = this.handHistory[this.historyIndex];
            playerHands = historicalState.playerHands;
            dealerHand = historicalState.dealer;
            titleText = `History (${this.historyIndex + 1}/${this.handHistory.length})`;
        } else {
            playerHands = this.blackjackGame.getPlayerHands();
            dealerHand = this.blackjackGame.getDealerHand();
            titleText = "Current Hands";
        }

        // Update header
        const titleSpan = this.dialogElement.querySelector('.bj-dialog-title') as HTMLElement;
        if (titleSpan) titleSpan.textContent = titleText;
        
        // Clear and rebuild content
        this.contentElement.innerHTML = '';
        this.buildNavControls(isHistoryView);

        const dealerSection = document.createElement('div');
        // Add margin to the bottom of the dealer section to prevent overlap
        // with an active player hand's box-shadow or border.
        dealerSection.style.marginBottom = '10px'; 
        this.renderHandInContainer('Dealer', dealerHand, this.lastDealerHand, isHistoryView, dealerSection);
        this.contentElement.appendChild(dealerSection);

        // Determine how many player hands will actually be displayed
        const displayablePlayerHandsInfo = playerHands.map((pHandInfo, index) => ({
            pHandInfo,
            index,
            shouldDisplay: index === 0 || pHandInfo.bet > 0
        })).filter(item => item.shouldDisplay);

        const numDisplayablePlayerHands = displayablePlayerHandsInfo.length;

        displayablePlayerHandsInfo.forEach(item => {
            const { pHandInfo, index } = item;
            const lastPHandInfo = !isHistoryView ? this.lastPlayerHands.find(h => h.id === pHandInfo.id) : undefined;
            this.renderPlayerHandInContainer(pHandInfo, lastPHandInfo, isHistoryView, this.contentElement, index, numDisplayablePlayerHands);
        });

        if (!isHistoryView) {
            this.lastPlayerHands = playerHands.map(h => ({ ...h, cards: [...h.cards] }));
            this.lastDealerHand = [...dealerHand];
        }
    }

    private buildNavControls(isHistoryView: boolean): void {
        const header = this.dialogElement.querySelector('.bj-dialog-header');
        if (!header) return;

        let navContainer = header.querySelector('.debug-header-nav') as HTMLElement;
        if (navContainer) navContainer.remove();

        navContainer = document.createElement('div');
        navContainer.className = 'debug-header-nav';
        
        const createNavButton = (text: string, onClick: () => void, disabled: boolean = false): HTMLButtonElement => {
            const button = document.createElement('button');
            button.innerHTML = text;
            button.onclick = onClick;
            button.disabled = disabled;
            return button;
        };

        if (isHistoryView) {
            navContainer.appendChild(createNavButton('🏠&nbsp;Current', () => { this.historyIndex = -1; this.update(); }));
        }
        if (this.historyIndex > -1) {
            navContainer.appendChild(createNavButton('Next →', () => { if (this.historyIndex > 0) this.historyIndex--; this.update(); }, this.historyIndex === 0));
        }
        if (this.historyIndex < this.handHistory.length - 1) {
            navContainer.appendChild(createNavButton('← Prev', () => { if (this.historyIndex < this.handHistory.length - 1) this.historyIndex++; this.update(); }, this.historyIndex === this.handHistory.length - 1 && this.historyIndex !== -1));
        }
        if (this.handHistory.length > 0 && this.historyIndex === -1) {
            navContainer.appendChild(createNavButton('← Prev', () => { this.historyIndex = 0; this.update(); }));
        }

        // Insert nav before the close button
        const closeButton = header.querySelector('.bj-dialog-close-button');
        if (closeButton) {
            header.insertBefore(navContainer, closeButton);
        } else {
            header.appendChild(navContainer);
        }
    }

    private createCardElement(card: Card, isNew: boolean): HTMLElement {
        const container = document.createElement('div');
        container.className = 'debug-card-container';
        const cardEl = document.createElement('playing-card');
        cardEl.setAttribute('cid', card.getCid());
        if (isNew) {
            cardEl.classList.add('card-dealt');
            setTimeout(() => cardEl.classList.remove('card-dealt'), 500);
        }
        container.appendChild(cardEl);
        const indicator = document.createElement('span');
        indicator.className = 'debug-card-indicator';
        indicator.innerHTML = card.isFaceUp() ? `👁️` : `❓`;
        if (!card.isFaceUp()) indicator.style.color = '#aaa';
        container.appendChild(indicator);
        return container;
    }

    private renderHandInContainer(title: string, currentHand: Card[], lastHand: Card[], isHistoryView: boolean, parentElement: HTMLElement): void {
        const section = document.createElement('div');
        const headerEl = document.createElement('h4');
        let headerText = title;
        if (currentHand) {
            headerText += ` (Score: ${ScoreCalculator.calculateHandValue(currentHand)})`;
        }
        headerEl.textContent = headerText;
        // Reduced top margin from 10px to 5px
        Object.assign(headerEl.style, { margin: '5px 0 5px 0', borderBottom: '1px solid #999', paddingBottom: '3px' });
        section.appendChild(headerEl);

        const container = document.createElement('div');
        Object.assign(container.style, { display: 'flex', flexWrap: 'wrap', gap: '5px' });
        section.appendChild(container);
        parentElement.appendChild(section);

        const currentCardIds = new Set(currentHand.map(c => c.getUniqueId()));
        const lastCardIds = new Set(lastHand.map(c => c.getUniqueId()));

        if (!isHistoryView) {
            [...lastHand].reverse().forEach(card => {
                if (!currentCardIds.has(card.getUniqueId())) {
                    const discardedEl = this.createCardElement(card, false);
                    discardedEl.classList.add('card-discarded');
                    container.appendChild(discardedEl);
                    setTimeout(() => discardedEl.remove(), 500);
                }
            });
        }
        [...currentHand].reverse().forEach(card => {
            const isNew = !isHistoryView && !lastCardIds.has(card.getUniqueId());
            container.appendChild(this.createCardElement(card, isNew));
        });
        if (currentHand.length === 0 && (isHistoryView || lastHand.length === 0)) {
            container.textContent = 'No cards';
        }
    }

    private renderPlayerHandInContainer(playerHandInfo: PlayerHandInfo, lastPlayerHandInfo: PlayerHandInfo | undefined, isHistoryView: boolean, parentElement: HTMLElement, handIndex: number, numDisplayablePlayerHands: number): void {
        const section = document.createElement('div');
        section.className = 'debug-player-hand-section';
        if (!isHistoryView && handIndex === this.blackjackGame.getActivePlayerHandIndex()) {
            section.classList.add('active-hand');
        }
        const headerEl = document.createElement('h4');
        
        let title: string;
        if (handIndex === 0 && numDisplayablePlayerHands === 1) {
            title = "Player Hand";
        } else {
            title = `Player Hand ${handIndex}`;
        }

        if (playerHandInfo) {
            title += ` (Bet: ${playerHandInfo.bet}, Score: ${ScoreCalculator.calculateHandValue(playerHandInfo.cards)}, Result: ${GameResult[playerHandInfo.result]}, Resolved: ${playerHandInfo.isResolved})`;
        }
        headerEl.textContent = title;
        Object.assign(headerEl.style, { margin: '10px 0 5px 0', borderBottom: '1px solid #999', paddingBottom: '3px' });
        section.appendChild(headerEl);

        const container = document.createElement('div');
        Object.assign(container.style, { display: 'flex', flexWrap: 'wrap', gap: '5px' });
        section.appendChild(container);
        parentElement.appendChild(section);

        const currentCards = playerHandInfo.cards;
        const lastCards = lastPlayerHandInfo ? lastPlayerHandInfo.cards : [];
        const currentCardIds = new Set(currentCards.map(c => c.getUniqueId()));
        const lastCardIds = new Set(lastCards.map(c => c.getUniqueId()));

        if (!isHistoryView) {
            [...lastCards].reverse().forEach(card => {
                if (!currentCardIds.has(card.getUniqueId())) {
                    const discardedEl = this.createCardElement(card, false);
                    discardedEl.classList.add('card-discarded');
                    container.appendChild(discardedEl);
                    setTimeout(() => discardedEl.remove(), 500);
                }
            });
        }
        [...currentCards].reverse().forEach(card => {
            const isNew = !isHistoryView && !lastCardIds.has(card.getUniqueId());
            container.appendChild(this.createCardElement(card, isNew));
        });
        if (currentCards.length === 0 && (isHistoryView || lastCards.length === 0)) {
            container.textContent = 'No cards';
        }
    }
}

/**
 * A dialog that displays the current cards in the deck for debugging.
 */
export class DeckInspectorDialog extends DynamicDialog {
    private blackjackGame: BlackjackGame;

    constructor(blackjackGame: BlackjackGame, onToggle: () => void) {
        super("blackjack-deck-inspector", "Deck Inspector", { left: '10px', top: '450px' }, onToggle);
        this.blackjackGame = blackjackGame;
        this.dialogElement.style.width = '420px'; // Accommodate 6 cards + gap
        this.dialogElement.style.maxHeight = '80vh';
        this.contentElement.style.maxHeight = 'calc(80vh - 50px)'; // Adjust for header
    }

    public update(): void {
        const deckCards = this.blackjackGame.getHandManager().getDeckCards();
        const titleSpan = this.dialogElement.querySelector('.bj-dialog-title') as HTMLElement;
        if (titleSpan) {
            titleSpan.textContent = `Deck Inspector (${deckCards.length} cards)`;
        }

        this.contentElement.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'deck-inspector-grid';

        deckCards.forEach(card => {
            grid.appendChild(this.createCardElement(card));
        });

        this.contentElement.appendChild(grid);
    }

    private createCardElement(card: Card): HTMLElement {
        const container = document.createElement('div');
        container.className = 'debug-card-container';
        const cardEl = document.createElement('playing-card');
        cardEl.setAttribute('cid', card.getCid());
        container.appendChild(cardEl);
        return container;
    }
}

/**
 * A dialog that shows the main debug menu with actions and scenarios.
 */
export class DebugMenuDialog extends DynamicDialog {
    private debugManager: DebugManager;
    private openSubMenu: HTMLElement | null = null;
    private activeSubMenuTrigger: HTMLElement | null = null;
    private boundHandleSubMenuAccessKeys: (event: KeyboardEvent) => void;
    private hoverOpenTimer: number | null = null;
    private hoverCloseTimer: number | null = null;
    private readonly HOVER_OPEN_DELAY = 350;
    private readonly HOVER_CLOSE_DELAY = 250;

    constructor(debugManager: DebugManager) {
        super("blackjack-debug-menu", "Debug Menu", { left: 'calc(100vw - 270px)', top: '10px' }, () => debugManager.toggleDebugMenu(false));
        this.debugManager = debugManager;
        this.boundHandleSubMenuAccessKeys = this.handleSubMenuAccessKeys.bind(this);
        this.dialogElement.classList.remove("bj-dialog-draggable");
        this.dialogElement.classList.add("debug-window-base");
        this.dialogElement.style.minWidth = '220px';
        this.dialogElement.style.maxWidth = '280px';
        this.buildContent();
        document.addEventListener('click', this.handleGlobalClick.bind(this), true);
    }

    private buildContent(): void {
        this.contentElement.className = 'debug-menu-button-container';

        const createButton = (text: string, action: () => void) => {
            const button = document.createElement('button');
            button.className = 'debug-menu-button';
            button.textContent = text;
            button.onclick = (e) => { e.stopPropagation(); action(); };
            this.contentElement.appendChild(button);
        };
        const createSeparator = () => {
            const separator = document.createElement('div');
            separator.className = 'debug-menu-separator';
            this.contentElement.appendChild(separator);
        };

        this.createDropdownButton('Start Scenario ▸', [
            { text: 'Start Hand (Normal)', action: () => this.debugManager.debugStartNormalHand(), accessKey: 'N' },
            { text: 'Start Split Hand Pair', action: () => this.debugManager.debugStartSplitHand(), accessKey: 'S' },
            { text: 'Start Insurance Hand', action: () => this.debugManager.debugStartInsuranceHand(), accessKey: 'I' }
        ], this.contentElement, false);
        createSeparator();
        createButton('Toggle Card Debug Window', () => this.debugManager.toggleHandDisplay());
        createButton('Reveal Dealer Hole Card', () => this.debugManager.revealDealerHole());
        this.createDropdownButton('Manage Deck ▸', [
            { text: 'Deck Inspector', action: () => this.debugManager.toggleDeckInspector(), accessKey: 'D' },
            { text: 'Force Reshuffle Deck', action: () => this.debugManager.forceReshuffle(), accessKey: 'R' },
            { text: 'Set Deck to all 2s', action: () => this.debugManager.setDeckToTwos(), accessKey: '2' }
        ], this.contentElement, false);
        createButton('Reset Game', () => this.debugManager.resetGame());
        createSeparator();
        this.createDropdownButton('Manage Funds ▸', [
            { text: 'Set Player Funds...', action: () => this.debugManager.setFunds(), accessKey: 'F' },
            { text: 'Reset Player Bank', action: () => this.debugManager.resetFunds(), accessKey: 'R' }
        ], this.contentElement, false);
        createSeparator();
        this.createDropdownButton('Force Outcome ▸', [
            { text: 'Force Player Win (Active Hand)', action: () => this.debugManager.forceWin(true), accessKey: 'P' },
            { text: 'Force Dealer Win (Active Hand)', action: () => this.debugManager.forceWin(false), accessKey: 'D' },
            { text: 'Force Push (Active Hand)', action: () => this.debugManager.forcePush(), accessKey: 'U' }
        ], this.contentElement, false);
        createSeparator();
        this.createDropdownButton('Diagnose Visuals ▸', [
            { text: 'Log Scene Render Order', action: () => this.debugManager.logSceneRenderOrder(), accessKey: 'O' },
            { text: 'Toggle Card Depth Write', action: () => this.debugManager.toggleCardDepthWrite(), accessKey: 'W' },
            { text: 'Log Player Hand 0 Visuals', action: () => this.debugManager.logHandVisuals(true, 0) },
            { text: 'Log Player Hand 1 Visuals', action: () => this.debugManager.logHandVisuals(true, 1) },
            { text: 'Log Player Hand 2 Visuals', action: () => this.debugManager.logHandVisuals(true, 2) },
            { text: 'Log Player Hand 3 Visuals', action: () => this.debugManager.logHandVisuals(true, 3) },
            { text: 'Log Dealer Hand Visuals', action: () => this.debugManager.logHandVisuals(false, 0) },
        ], this.contentElement, false);
    }

    private handleGlobalClick = (event: MouseEvent): void => {
        if (this.openSubMenu) {
            const target = event.target as HTMLElement;
            if ((this.activeSubMenuTrigger && this.activeSubMenuTrigger.contains(target)) || this.openSubMenu.contains(target)) {
                return;
            }
            this.closeOpenSubMenuAndCleanup(true);
        }
    };

    private formatTextWithAccessKey(text: string, accessKey?: string): string {
        if (!accessKey || accessKey.length !== 1) return text;
        const keyIndex = text.toLowerCase().indexOf(accessKey.toLowerCase());
        if (keyIndex === -1) return text;
        return `${text.substring(0, keyIndex)}<u>${text.substring(keyIndex, keyIndex + 1)}</u>${text.substring(keyIndex + 1)}`;
    }

    private closeOpenSubMenuAndCleanup(removeFromDom: boolean): void {
        this.clearHoverTimers();
        if (this.openSubMenu) {
            document.removeEventListener('keydown', this.boundHandleSubMenuAccessKeys);
            if (removeFromDom && this.openSubMenu.parentNode === this.dialogElement) { // Changed from document.body
                this.dialogElement.removeChild(this.openSubMenu); // Changed from document.body
            }
            this.openSubMenu.style.display = 'none';
            this.openSubMenu = null;
            this.activeSubMenuTrigger = null;
        }
    }

    private handleSubMenuAccessKeys(event: KeyboardEvent): void {
        if (!this.openSubMenu) return;
        this.clearHoverTimers();
        if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation();
            const triggerToFocus = this.activeSubMenuTrigger;
            this.closeOpenSubMenuAndCleanup(true);
            triggerToFocus?.focus();
            return;
        }
        if (event.key === 'Tab') {
            event.preventDefault(); event.stopPropagation();
            const focusableItems = Array.from(this.openSubMenu.querySelectorAll('.debug-submenu-button')) as HTMLElement[];
            if (focusableItems.length === 0) return;
            let currentIndex = focusableItems.indexOf(document.activeElement as HTMLElement);
            currentIndex = (event.shiftKey ? currentIndex - 1 + focusableItems.length : currentIndex + 1) % focusableItems.length;
            focusableItems[currentIndex]?.focus();
            return;
        }
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const pressedKey = event.key.toLowerCase();
        for (const child of Array.from(this.openSubMenu.children)) {
            const button = child as HTMLElement;
            if (button.dataset.accessKey === pressedKey) {
                event.preventDefault(); event.stopPropagation();
                button.click();
                return;
            }
        }
    }

    private clearHoverTimers(): void {
        if (this.hoverOpenTimer) clearTimeout(this.hoverOpenTimer);
        if (this.hoverCloseTimer) clearTimeout(this.hoverCloseTimer);
        this.hoverOpenTimer = null;
        this.hoverCloseTimer = null;
    }

    private openSubMenuLogic(subMenu: HTMLElement, triggerButton: HTMLElement, openLeft: boolean): void {
        this.clearHoverTimers();
        if (this.openSubMenu === subMenu && subMenu.style.display === 'block') return;
        if (this.openSubMenu && this.openSubMenu !== subMenu) this.closeOpenSubMenuAndCleanup(true);

        // Ensure submenu is a child of the dialog element
        if (subMenu.parentNode !== this.dialogElement) {
            if (subMenu.parentNode) { // If parented elsewhere, remove it first
                subMenu.parentNode.removeChild(subMenu);
            }
            this.dialogElement.appendChild(subMenu);
        }
        
        subMenu.style.visibility = 'hidden'; // Calculate size before making visible
        subMenu.style.display = 'block';
        subMenu.style.position = 'absolute'; // Position relative to dialogElement

        const triggerRect = triggerButton.getBoundingClientRect();
        const dialogRect = this.dialogElement.getBoundingClientRect();
        const subMenuWidth = subMenu.offsetWidth;
        const subMenuHeight = subMenu.offsetHeight;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate target viewport top for the submenu
        let targetVPTop = triggerRect.top;
        if (targetVPTop + subMenuHeight > viewportHeight) {
            targetVPTop = viewportHeight - subMenuHeight;
        }
        targetVPTop = Math.max(0, targetVPTop); // Clamp to viewport top edge

        // Calculate target viewport left for the submenu using original logic structure
        let targetVPLeftCandidate;
        if (openLeft) {
            if (triggerRect.left - subMenuWidth >= 0) {
                targetVPLeftCandidate = triggerRect.left - subMenuWidth;
            } else {
                // Fallback to opening right if opening left goes off-screen
                targetVPLeftCandidate = triggerRect.right;
            }
        } else { // Default is to open right
            if (triggerRect.right + subMenuWidth <= viewportWidth) {
                targetVPLeftCandidate = triggerRect.right;
            } else {
                // Fallback to opening left if opening right goes off-screen
                targetVPLeftCandidate = triggerRect.left - subMenuWidth;
            }
        }
        
        // Clamp the candidate to ensure it's within viewport boundaries
        const targetVPLeft = Math.max(0, Math.min(targetVPLeftCandidate, viewportWidth - subMenuWidth));
        
        // Convert viewport-relative coordinates to dialog-relative coordinates
        subMenu.style.top = `${targetVPTop - dialogRect.top}px`;
        subMenu.style.left = `${targetVPLeft - dialogRect.left}px`;
        
        subMenu.style.visibility = 'visible';
        this.openSubMenu = subMenu;
        this.activeSubMenuTrigger = triggerButton;
        document.addEventListener('keydown', this.boundHandleSubMenuAccessKeys);
        if (document.activeElement === triggerButton) {
            (subMenu.querySelector('.debug-submenu-button') as HTMLElement)?.focus();
        }
    }

    private createDropdownButton(mainButtonText: string, items: { text: string, action: () => void, accessKey?: string }[], parentContainer: HTMLElement, openLeft: boolean): void {
        const group = document.createElement('div');
        group.className = 'debug-menu-button-group';
        const mainButton = document.createElement('button');
        mainButton.className = 'debug-menu-button';
        mainButton.textContent = mainButtonText;
        const subMenu = document.createElement('div');
        subMenu.className = 'debug-submenu';
        items.forEach(item => {
            const subButton = document.createElement('button');
            subButton.className = 'debug-submenu-button';
            subButton.innerHTML = this.formatTextWithAccessKey(item.text, item.accessKey);
            if (item.accessKey) subButton.dataset.accessKey = item.accessKey.toLowerCase();
            subButton.onclick = (e) => {
                e.stopPropagation();
                this.clearHoverTimers();
                item.action();
                this.closeOpenSubMenuAndCleanup(true);
            };
            subMenu.appendChild(subButton);
        });
        mainButton.onclick = (e) => {
            e.stopPropagation();
            this.clearHoverTimers();
            // Always call openSubMenuLogic.
            // It handles closing other submenus or returning if this one is already open.
            this.openSubMenuLogic(subMenu, mainButton, openLeft);
        };
        mainButton.onmouseenter = () => {
            this.clearHoverTimers();
            this.hoverOpenTimer = window.setTimeout(() => this.openSubMenuLogic(subMenu, mainButton, openLeft), this.HOVER_OPEN_DELAY);
        };
        mainButton.onmouseleave = () => {
            this.clearHoverTimers();
            this.hoverCloseTimer = window.setTimeout(() => {
                if (this.openSubMenu === subMenu && !subMenu.matches(':hover')) this.closeOpenSubMenuAndCleanup(true);
            }, this.HOVER_CLOSE_DELAY);
        };
        subMenu.onmouseenter = () => this.clearHoverTimers();
        subMenu.onmouseleave = () => {
            this.clearHoverTimers();
            this.hoverCloseTimer = window.setTimeout(() => {
                if (this.openSubMenu === subMenu) this.closeOpenSubMenuAndCleanup(true);
            }, this.HOVER_CLOSE_DELAY);
        };
        group.appendChild(mainButton);
        parentContainer.appendChild(group);
    }

    public dispose(): void {
        this.closeOpenSubMenuAndCleanup(true);
        document.removeEventListener('click', this.handleGlobalClick, true);
        super.dispose();
    }
}

/**
 * A modal dialog for custom user input.
 */
export class CustomPromptDialog {
    public static show(message: string, defaultValue: string, onConfirm: (value: string | null) => void): void {
        injectDialogStyles();
        let dialogInstance: DynamicDialog | null = null;
        let escapeListener: ((event: KeyboardEvent) => void) | null = null;

        const closePrompt = (isCancel: boolean, value?: string) => {
            if (escapeListener) document.removeEventListener('keydown', escapeListener);
            if (overlay) overlay.remove();
            onConfirm(isCancel ? null : (value ?? ''));
        };

        const overlay = document.createElement('div');
        overlay.className = 'debug-prompt-overlay';
        overlay.onclick = () => closePrompt(true);

        const dialog = document.createElement('div');
        // Add bj-dialog-base for theme, debug-prompt-dialog for specific positioning/sizing.
        dialog.className = 'debug-prompt-dialog bj-dialog-base'; 
        dialog.onclick = (e) => e.stopPropagation();
        
        const header = document.createElement('div');
        header.className = 'bj-dialog-header';
        const titleSpan = document.createElement('span');
        titleSpan.className = 'bj-dialog-title';
        titleSpan.textContent = "Set Value";
        const closeButton = document.createElement('button');
        closeButton.className = 'bj-dialog-close-button';
        closeButton.innerHTML = '&#x2715;';
        closeButton.onclick = () => closePrompt(true);
        header.appendChild(titleSpan);
        header.appendChild(closeButton);
        dialog.appendChild(header);

        const content = document.createElement('div');
        content.className = 'bj-dialog-content';
        const p = document.createElement('p');
        p.textContent = message;
        const input = document.createElement('input');
        input.type = 'number';
        input.value = defaultValue;
        input.onkeydown = (e) => {
            if (e.key === 'Enter') { e.preventDefault(); closePrompt(false, input.value); }
            else if (e.key === 'Escape') { e.preventDefault(); closePrompt(true); }
        };
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'debug-prompt-buttons';
        const confirmButton = document.createElement('button');
        confirmButton.textContent = 'Confirm';
        confirmButton.className = 'debug-prompt-confirm';
        confirmButton.onclick = () => closePrompt(false, input.value);
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'debug-prompt-cancel';
        cancelButton.onclick = () => closePrompt(true);
        buttonsDiv.appendChild(cancelButton);
        buttonsDiv.appendChild(confirmButton);
        content.appendChild(p);
        content.appendChild(input);
        content.appendChild(buttonsDiv);
        dialog.appendChild(content);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        // Make draggable by header
        dialogInstance = new (class extends DynamicDialog {
            constructor() {
                super('prompt-dialog-wrapper', '', {left: '0', top: '0'});
                this.dialogElement = dialog; // Hijack the dialog element
                this.makeDraggable(this.dialogElement, header);
            }
        })();
        
        dialogInstance.show(); // Explicitly show the dialog after creation and class assignment

        input.focus();
        input.select();

        escapeListener = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closePrompt(true);
        };
        document.addEventListener('keydown', escapeListener);
    }
}

/**
 * A confirmation dialog using BabylonJS GUI.
 */
export class ConfirmDialog {
    public static show(guiTexture: AdvancedDynamicTexture, message: string, onConfirm: () => void): void {
        const dialogContainer = new Rectangle("confirmDialogContainer");
        dialogContainer.width = 1.0;
        dialogContainer.height = 1.0;
        dialogContainer.background = "rgba(0, 0, 0, 0.7)";
        dialogContainer.zIndex = 100;
        guiTexture.addControl(dialogContainer);

        const panelContainer = new Rectangle("confirmDialogPanelContainer");
        panelContainer.width = "400px";
        panelContainer.adaptHeightToChildren = true;
        panelContainer.background = "#444444";
        panelContainer.cornerRadius = 10;
        panelContainer.thickness = 1;
        panelContainer.color = "#666";
        panelContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        dialogContainer.addControl(panelContainer);

        const dialogPanel = new StackPanel("confirmDialogPanel");
        dialogPanel.paddingTop = "20px";
        dialogPanel.paddingBottom = "20px";
        dialogPanel.paddingLeft = "15px";
        dialogPanel.paddingRight = "15px";
        panelContainer.addControl(dialogPanel);

        const dialogText = new TextBlock("confirmText", message);
        dialogText.color = "white";
        dialogText.fontSize = 18;
        dialogText.height = "80px";
        dialogText.textWrapping = true;
        dialogPanel.addControl(dialogText);

        const buttonsPanel = new StackPanel("confirmButtonsPanel");
        buttonsPanel.isVertical = false;
        buttonsPanel.height = "50px";
        buttonsPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        buttonsPanel.spacing = 20;
        dialogPanel.addControl(buttonsPanel);

        const yesButton = Button.CreateSimpleButton("yesButton", "Yes");
        yesButton.width = "100px";
        yesButton.height = "40px";
        yesButton.color = "white";
        yesButton.background = "darkred";
        yesButton.cornerRadius = 5;
        yesButton.onPointerUpObservable.add(() => {
            onConfirm();
            guiTexture.removeControl(dialogContainer);
        });
        buttonsPanel.addControl(yesButton);

        const noButton = Button.CreateSimpleButton("noButton", "No");
        noButton.width = "100px";
        noButton.height = "40px";
        noButton.color = "white";
        noButton.background = "#555555";
        noButton.cornerRadius = 5;
        noButton.onPointerUpObservable.add(() => {
            guiTexture.removeControl(dialogContainer);
        });
        buttonsPanel.addControl(noButton);
    }
}