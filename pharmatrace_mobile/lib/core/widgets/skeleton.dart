import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

/// A reusable skeleton loader widget to display while data is being fetched.
/// Uses the Shimmer package to create a smooth sweeping animation.
class Skeleton extends StatelessWidget {
  final double? height;
  final double? width;
  final double borderRadius;

  const Skeleton({
    Key? key,
    this.height,
    this.width,
    this.borderRadius = 8.0, // Default border radius
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: Colors.grey[300]!,
      highlightColor: Colors.grey[100]!,
      child: Container(
        height: height,
        width: width,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}

/// A pre-configured skeleton layout specifically for the Medicine Cards.
/// Simulates the layout of the 'Reusable information patterns' in the design.
class MedicineCardSkeleton extends StatelessWidget {
  const MedicineCardSkeleton({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16.0),
      margin: const EdgeInsets.only(bottom: 16.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8.0),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title placeholder
          Skeleton(height: 20, width: 200),
          SizedBox(height: 16),
          // Subtitle/Detail placeholders
          Skeleton(height: 14, width: 150),
          SizedBox(height: 8),
          Skeleton(height: 14, width: 100),
          SizedBox(height: 24),
          // Action button/link placeholder
          Skeleton(height: 16, width: 120),
        ],
      ),
    );
  }
}
