// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title  PharmaTrace
 * @notice On-chain registry that lets Rwanda FDA regulators register manufacturers,
 *         approve and flag drug batches, and lets ANYONE (patients, pharmacists)
 *         verify a batch with a read-only call. No wallet is needed to verify.
 *
 * @dev    Privacy by design (Rwanda Law No. 058/2021): the chain stores only
 *         wallet addresses, timestamps, status flags and keccak256 hashes.
 *         Names, licence numbers, drug details and flag reasons stay in the
 *         off-chain PostgreSQL database; only their hashes are anchored here.
 */
contract PharmaTrace is AccessControl, Pausable {
    // ───────────────────────────── Roles ─────────────────────────────
    // DEFAULT_ADMIN_ROLE : Rwanda FDA admin (grants regulators, pauses contract)
    bytes32 public constant REGULATOR_ROLE    = keccak256("REGULATOR_ROLE");
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");

    // ───────────────────────────── Types ─────────────────────────────
    enum BatchStatus { None, Pending, Approved, Flagged }

    /// What the mobile app shows after a scan (maps 1:1 to a result screen).
    enum Verdict { NotFound, Authentic, Pending, Flagged, Expired, ManufacturerRevoked }

    struct Batch {
        address manufacturer;
        bytes32 metadataHash; // hash of off-chain details (drug name, strength, packaging…)
        uint64  mfgDate;
        uint64  expiryDate;
        uint64  approvedAt;
        BatchStatus status;
    }

    // ───────────────────────────── State ─────────────────────────────
    mapping(bytes32 => Batch) private _batches;
    mapping(address => bytes32) public licenseHashOf; // manufacturer wallet => hash(licence no.)

    // ───────────────────────────── Events ────────────────────────────
    // Events form the immutable, queryable history shown on the batch timeline.
    event ManufacturerRegistered(address indexed manufacturer, bytes32 licenseHash, address indexed regulator);
    event ManufacturerRevoked(address indexed manufacturer, address indexed regulator);
    event BatchSubmitted(
        bytes32 indexed batchId, address indexed manufacturer,
        bytes32 metadataHash, uint64 mfgDate, uint64 expiryDate
    );
    event BatchApproved(bytes32 indexed batchId, address indexed regulator);
    event BatchFlagged(bytes32 indexed batchId, address indexed regulator, bytes32 reasonHash);
    event BatchFlagResolved(bytes32 indexed batchId, address indexed regulator);

    // ───────────────────────────── Errors ────────────────────────────
    error InvalidAddress();
    error InvalidInput();
    error AlreadyRegistered();
    error NotAManufacturer();
    error BatchAlreadyExists();
    error BatchNotFound();
    error InvalidBatchState(BatchStatus current);

    // ─────────────────────────── Constructor ─────────────────────────
    constructor(address fdaAdmin) {
        if (fdaAdmin == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, fdaAdmin);
        _grantRole(REGULATOR_ROLE, fdaAdmin);
    }

    // ─────────────────── Regulator: manage manufacturers ─────────────
    function registerManufacturer(address wallet, bytes32 licenseHash)
        external
        onlyRole(REGULATOR_ROLE)
        whenNotPaused
    {
        if (wallet == address(0)) revert InvalidAddress();
        if (licenseHash == bytes32(0)) revert InvalidInput();
        if (hasRole(MANUFACTURER_ROLE, wallet)) revert AlreadyRegistered();

        licenseHashOf[wallet] = licenseHash;
        _grantRole(MANUFACTURER_ROLE, wallet);
        emit ManufacturerRegistered(wallet, licenseHash, msg.sender);
    }

    function revokeManufacturer(address wallet)
        external
        onlyRole(REGULATOR_ROLE)
        whenNotPaused
    {
        if (!hasRole(MANUFACTURER_ROLE, wallet)) revert NotAManufacturer();
        _revokeRole(MANUFACTURER_ROLE, wallet);
        emit ManufacturerRevoked(wallet, msg.sender);
    }

    // ─────────────────── Manufacturer: submit a batch ────────────────
    /// @return batchId keccak256(manufacturer, batchNo). This is what the QR code encodes.
    function submitBatch(
        string calldata batchNo,
        bytes32 metadataHash,
        uint64 mfgDate,
        uint64 expiryDate
    )
        external
        onlyRole(MANUFACTURER_ROLE)
        whenNotPaused
        returns (bytes32 batchId)
    {
        uint256 len = bytes(batchNo).length;
        if (len == 0 || len > 64) revert InvalidInput();
        if (metadataHash == bytes32(0)) revert InvalidInput();
        if (expiryDate <= mfgDate || expiryDate <= block.timestamp) revert InvalidInput();

        batchId = computeBatchId(msg.sender, batchNo);
        if (_batches[batchId].status != BatchStatus.None) revert BatchAlreadyExists();

        _batches[batchId] = Batch({
            manufacturer: msg.sender,
            metadataHash: metadataHash,
            mfgDate: mfgDate,
            expiryDate: expiryDate,
            approvedAt: 0,
            status: BatchStatus.Pending
        });
        emit BatchSubmitted(batchId, msg.sender, metadataHash, mfgDate, expiryDate);
    }

    // ─────────────────── Regulator: approve / flag / resolve ─────────
    function approveBatch(bytes32 batchId) external onlyRole(REGULATOR_ROLE) whenNotPaused {
        Batch storage b = _requireBatch(batchId);
        if (b.status != BatchStatus.Pending) revert InvalidBatchState(b.status);
        if (!hasRole(MANUFACTURER_ROLE, b.manufacturer)) revert NotAManufacturer();

        b.status = BatchStatus.Approved;
        b.approvedAt = uint64(block.timestamp);
        emit BatchApproved(batchId, msg.sender);
    }

    /// @dev Deliberately NOT gated by whenNotPaused: if the contract is paused during
    ///      an incident, regulators can still pull a dangerous batch. Pausing can never
    ///      be used to stop a recall, and no function can create a false "Authentic"
    ///      result while paused.
    function flagBatch(bytes32 batchId, bytes32 reasonHash) external onlyRole(REGULATOR_ROLE) {
        Batch storage b = _requireBatch(batchId);
        if (b.status != BatchStatus.Pending && b.status != BatchStatus.Approved) {
            revert InvalidBatchState(b.status);
        }
        if (reasonHash == bytes32(0)) revert InvalidInput();

        b.status = BatchStatus.Flagged;
        emit BatchFlagged(batchId, msg.sender, reasonHash);
    }

    function resolveFlag(bytes32 batchId) external onlyRole(REGULATOR_ROLE) whenNotPaused {
        Batch storage b = _requireBatch(batchId);
        if (b.status != BatchStatus.Flagged) revert InvalidBatchState(b.status);

        // Restore whatever state the batch had before it was flagged.
        b.status = b.approvedAt == 0 ? BatchStatus.Pending : BatchStatus.Approved;
        emit BatchFlagResolved(batchId, msg.sender);
    }

    // ─────────────────── Public: verification (no wallet needed) ─────
    /// @notice Called by the Node API on every QR scan. Free, read-only, open to everyone.
    function verifyBatch(bytes32 batchId) external view returns (Verdict verdict, Batch memory batch) {
        batch = _batches[batchId];

        if (batch.status == BatchStatus.None)    return (Verdict.NotFound, batch);
        if (batch.status == BatchStatus.Flagged) return (Verdict.Flagged, batch);
        if (!hasRole(MANUFACTURER_ROLE, batch.manufacturer)) return (Verdict.ManufacturerRevoked, batch);
        if (batch.status == BatchStatus.Pending) return (Verdict.Pending, batch);
        if (block.timestamp > batch.expiryDate)  return (Verdict.Expired, batch);

        return (Verdict.Authentic, batch);
    }

    function computeBatchId(address manufacturer, string calldata batchNo) public pure returns (bytes32) {
        return keccak256(abi.encode(manufacturer, batchNo));
    }

    // ─────────────────── Admin: incident response ────────────────────
    function pause()   external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    // ───────────────────────────── Internal ──────────────────────────
    function _requireBatch(bytes32 batchId) private view returns (Batch storage b) {
        b = _batches[batchId];
        if (b.status == BatchStatus.None) revert BatchNotFound();
    }
}
