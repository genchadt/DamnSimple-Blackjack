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
export const DEFAULT_FUNDS = 1000;
export const MIN_BET = 10;
export const DEFAULT_BET = 10; // Added for BettingUI default
export const BET_INCREMENT = 5; // Added for BettingUI increment
export const INSURANCE_BET_RATIO = 0.5; // Insurance costs 50% of the original bet
export const INSURANCE_PAYOUT_RATIO = 2; // Insurance pays 2:1 (meaning player gets original insurance bet + 2x that bet back)
export const DEALER_STAND_SCORE = 17; // Dealer stands on 17 or more
export const MIN_CARDS_BEFORE_SHUFFLE = 15; // Example value, adjust as needed
export const MAX_SPLIT_HANDS = 4; // Maximum number of hands a player can have after splits

// *** NEW CONSTANTS FOR NUMBER OF DECKS ***
export const DEFAULT_NUM_DECKS = 6;
export const MIN_NUM_DECKS = 1;
export const MAX_NUM_DECKS = 8;


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

// --- Player Hand Specific Layout ---
const PLAYER_CARD_STACK_X_OFFSET = CARD_WIDTH * 0.3; // Horizontal overlap, shows ~30% of card face. Used for player hand centering.
const PLAYER_CARD_STACK_Y_OFFSET = CARD_DEPTH * 5.0;  // *** FIXED: Increased significantly for a larger safety margin to prevent z-fighting.

// --- Split Hand Visuals ---
const SPLIT_WAITING_HAND_X = 3.5; // X position for the rightmost waiting split hand (anchor point)
const SPLIT_WAITING_HAND_Y = -1.5; // Y position for waiting split hands (bottom area)
const SPLIT_WAITING_HAND_Z = PLAYER_HAND_Z + 0.5; // Slightly behind player's main hand Z
const SPLIT_WAITING_HAND_SCALE = 0.65; // Scale factor for miniaturized waiting hands
const SPLIT_CARD_ANIM_DURATION_MS = 300; // Animation duration for cards moving during split/rearrange


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
    INSURANCE_BET_RATIO,
    INSURANCE_PAYOUT_RATIO,
    DEALER_STAND_SCORE,
    MIN_CARDS_BEFORE_SHUFFLE,
    MAX_SPLIT_HANDS,
    DEFAULT_NUM_DECKS,
    MIN_NUM_DECKS,
    MAX_NUM_DECKS,

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

    // Player Hand Specific Layout
    PLAYER_CARD_STACK_X_OFFSET,
    PLAYER_CARD_STACK_Y_OFFSET,

    // Split Hand Visuals
    SPLIT_WAITING_HAND_X,
    SPLIT_WAITING_HAND_Y,
    SPLIT_WAITING_HAND_Z,
    SPLIT_WAITING_HAND_SCALE,
    SPLIT_CARD_ANIM_DURATION_MS,

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
