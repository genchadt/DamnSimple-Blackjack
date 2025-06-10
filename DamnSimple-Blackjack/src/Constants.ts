// src/Constants.ts
import { Vector3 } from "@babylonjs/core";

// --- Graphics Quality ---
/** Defines quality settings for rendering and textures. */
export const QualitySettings = {
    Low: { name: "Low", textureSize: 256 },
    Medium: { name: "Medium", textureSize: 512 },
    High: { name: "High", textureSize: 1024 },
    Ultra: { name: "Ultra", textureSize: 2048 },
};
export type QualityLevel = keyof typeof QualitySettings;
export const DEFAULT_QUALITY_LEVEL: QualityLevel = "Medium";

// --- UI Scale ---
/** Defines UI scale settings. The scale factor is applied to GUI textures. */
export const UIScaleSettings = {
    Small: { name: "Small", scale: 0.8 },
    Normal: { name: "Normal", scale: 1.0 },
    Large: { name: "Large", scale: 1.2 },
    ExtraLarge: { name: "X-Large", scale: 1.4 },
};
export type UIScaleLevel = keyof typeof UIScaleSettings;
export const DEFAULT_UI_SCALE_LEVEL: UIScaleLevel = "Normal";

// --- UI Rendering ---
export const UI_IDEAL_WIDTH = 1920;
export const UI_IDEAL_HEIGHT = 1080;


// --- Game Rules ---
const DEFAULT_FUNDS = 1000;
const MIN_BET = 10;
const DEFAULT_BET = MIN_BET; // Default bet is the minimum bet
const BET_INCREMENT = 10;
const MIN_CARDS_BEFORE_SHUFFLE = 15; // Deck reshuffle threshold
const DEALER_STAND_SCORE = 17; // Dealer must stand on 17 or higher
const INSURANCE_BET_RATIO = 0.5; // Insurance bet is 50% of the original bet
const INSURANCE_PAYOUT_RATIO = 2; // Insurance pays 2:1

// --- Layout Positions (Z-axis is depth from camera) ---
const PLAYER_HAND_Z = 2.2;
const DEALER_HAND_Z = -2.2;
const DECK_POSITION_X = 4.0;
const DECK_POSITION_Z = -2.5;
const CARD_Y_POS = 0.05; // How high cards sit off the table surface
const DECK_DISPENSER_Y_OFFSET = 0.10; // How high the center of the dispenser is above CARD_Y_POS

// --- Card Visuals & Spacing ---
const CARD_SCALE = 1.0; // Default scale for cards
const CARD_ASPECT_RATIO = 1.4; // Height / Width
const CARD_WIDTH = 1.0 * CARD_SCALE;
const CARD_HEIGHT = CARD_WIDTH * CARD_ASPECT_RATIO;
const CARD_DEPTH = 0.02 * CARD_SCALE; // Thickness scales too
const CARD_CORNER_RADIUS = 0.08 * CARD_SCALE; // Rounded corners scale
const CARD_SPACING = CARD_WIDTH + 0.15; // Horizontal space between cards in hand (used for Dealer)
// const CARD_STACK_OFFSET = CARD_DEPTH + 0.002; // Vertical offset for cards in hand // REMOVED

// --- Player Hand Specific Layout ---
// The PLAYER_HAND_START_X constant is no longer used for player card positioning.
// Player card X positions are now dynamically calculated in CardVisualizer.calculateCardPosition
// to ensure the hand is always centered on the X-axis.
/*
// OLD COMMENT AND CONSTANT:
// PLAYER_HAND_START_X: Calculated to roughly center a 5-card hand.
// A 5-card hand: Card1_X_Start to Card5_X_End.
// Card5_X_Start = PLAYER_HAND_START_X + 4 * PLAYER_CARD_STACK_X_OFFSET
// Card5_X_End = Card5_X_Start + CARD_WIDTH
// Center of 5 cards = (Card1_X_Start + Card5_X_End) / 2
// If PLAYER_CARD_STACK_X_OFFSET = CARD_WIDTH * 0.3:
// Card5_X_Start = PLAYER_HAND_START_X + 4 * 0.3 * CARD_WIDTH = PLAYER_HAND_START_X + 1.2 * CARD_WIDTH
// Card5_X_End = PLAYER_HAND_START_X + 1.2 * CARD_WIDTH + CARD_WIDTH = PLAYER_HAND_START_X + 2.2 * CARD_WIDTH
// Center = (PLAYER_HAND_START_X + PLAYER_HAND_START_X + 2.2 * CARD_WIDTH) / 2
// Center = PLAYER_HAND_START_X + 1.1 * CARD_WIDTH
// For Center = 0: PLAYER_HAND_START_X = -1.1 * CARD_WIDTH
// const PLAYER_HAND_START_X = -1.1 * CARD_WIDTH; // DEPRECATED
*/

const PLAYER_CARD_STACK_X_OFFSET = CARD_WIDTH * 0.3; // Horizontal overlap, shows ~30% of card face. Used for player hand centering.
const PLAYER_CARD_STACK_Y_OFFSET = CARD_DEPTH * 0.75;  // Slight vertical lift for each card in player's hand for stacking.

// --- Animation ---
const FPS = 60;
const DEAL_SLIDE_DURATION_MS = 450;
const DEAL_ROTATION_DURATION_MS = 400;
const REPOSITION_DURATION_MS = DEAL_SLIDE_DURATION_MS; // Match deal slide speed
const FLIP_DURATION_MS = 350;

/**
 * Defines common constants used throughout the application.
 */
export const Constants = {
    // Game Rules
    DEFAULT_FUNDS,
    MIN_BET,
    DEFAULT_BET,
    BET_INCREMENT,
    MIN_CARDS_BEFORE_SHUFFLE,
    DEALER_STAND_SCORE,
    INSURANCE_BET_RATIO,
    INSURANCE_PAYOUT_RATIO,

    // Layout
    PLAYER_HAND_Z,
    DEALER_HAND_Z,
    DECK_POSITION_X,
    DECK_POSITION_Z,
    CARD_Y_POS, // Y position of cards flat on table
    DECK_DISPENSER_Y_OFFSET, // Offset for the dispenser center relative to card Y pos

    // Card Visuals
    CARD_SCALE,
    CARD_ASPECT_RATIO,
    CARD_WIDTH,
    CARD_HEIGHT,
    CARD_DEPTH,
    CARD_CORNER_RADIUS,
    CARD_SPACING, // Used for Dealer hand
    // CARD_STACK_OFFSET, // REMOVED

    // Player Hand Specific Layout
    // PLAYER_HAND_START_X, // DEPRECATED - Player hand X positions are dynamically centered
    PLAYER_CARD_STACK_X_OFFSET,
    PLAYER_CARD_STACK_Y_OFFSET,

    // Animation
    FPS,
    DEAL_SLIDE_DURATION_MS,
    DEAL_ROTATION_DURATION_MS,
    REPOSITION_DURATION_MS,
    FLIP_DURATION_MS,
};

// Pre-calculated Vector3 for the Deck's XZ position
export const DefaultDeckPositionXZ = new Vector3(
    Constants.DECK_POSITION_X,
    0, // Y is set dynamically based on table height + offsets
    Constants.DECK_POSITION_Z
);
