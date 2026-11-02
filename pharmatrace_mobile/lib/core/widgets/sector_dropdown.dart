import 'package:flutter/material.dart';
import '../sectors.dart';
import '../theme.dart';

/// Pick one of Kigali's sectors. The district is shown next to each name.
class SectorDropdown extends StatelessWidget {
  final String? value;
  final ValueChanged<String?> onChanged;
  final bool enabled;
  final String label;

  const SectorDropdown({
    Key? key,
    required this.value,
    required this.onChanged,
    this.enabled = true,
    this.label = 'Sector',
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final sectors = allSectors();

    return InputDecorator(
      isEmpty: value == null,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(Icons.location_on_outlined, color: c.accent),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          isExpanded: true,
          isDense: true,
          menuMaxHeight: 360,
          icon: Icon(Icons.arrow_drop_down, color: c.accent),
          onChanged: enabled ? onChanged : null,
          items: [
            for (final sector in sectors)
              DropdownMenuItem<String>(
                value: sector,
                child: Row(
                  children: [
                    Expanded(child: Text(sector)),
                    Text(
                      districtOfSector(sector) ?? '',
                      style: TextStyle(color: c.textSecondary, fontSize: 12),
                    ),
                  ],
                ),
              ),
          ],
          selectedItemBuilder: (context) => [
            for (final sector in sectors)
              Align(alignment: Alignment.centerLeft, child: Text(sector)),
          ],
        ),
      ),
    );
  }
}
