import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Global theme configuration for PharmaTrace.
class AppTheme {
  // Core Palette
  static const Color primaryColor = Color(0xFF0F7A5F); // Dark teal/green
  static const Color backgroundColor = Color(0xFFF8F9FA); // Off-white canvas
  static const Color surfaceColor = Colors.white;
  static const Color textPrimary = Color(0xFF1F2937); // Dark gray headline
  static const Color textSecondary = Color(0xFF6B7280); // Lighter gray body
  static const Color borderColor = Color(0xFFE5E7EB); // Light gray borders

  // Verification Status Colors[cite: 7]
  static const Color statusAuthentic = Color(0xFF059669);
  static const Color statusFlagged = Color(0xFFDC2626);
  static const Color statusPending = Color(0xFFD97706);
  static const Color statusExpired = Color(0xFFD97706);
  static const Color statusNotFound = Color(0xFF6B7280);

  /// Builds and returns the global Material ThemeData
  static ThemeData get lightTheme {
    return ThemeData(
      primaryColor: primaryColor,
      scaffoldBackgroundColor: backgroundColor,
      // Apply the 'Inter' font family globally
      textTheme: GoogleFonts.interTextTheme().apply(
        bodyColor: textPrimary,
        displayColor: textPrimary,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: surfaceColor,
        elevation: 0,
        iconTheme: IconThemeData(color: textPrimary),
        titleTextStyle: TextStyle(
          color: textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      ),
      // Standardized button styling for the 'Primary / default'
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryColor,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 50), // Full width, 50px height
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8), // 8px border radius
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
