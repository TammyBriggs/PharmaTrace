import 'package:flutter/material.dart';

import '../../core/auth_manager.dart';
import '../../core/main_navigation.dart';
import '../../core/strings.dart';
import '../../core/theme.dart';
import '../../core/widgets/password_field.dart';
import '../../core/widgets/password_rules.dart';
import '../../data/services/api_service.dart';
import '../onboarding/onboarding_screen.dart';

/// Used in two places:
/// - [forced] after a sign-in with a temporary password: nothing else in the app works until it is done.
/// - from Profile, where the person can also back out.
class ChangePasswordScreen extends StatefulWidget {
  final bool forced;
  const ChangePasswordScreen({super.key, this.forced = false});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _current = TextEditingController();
  final _new = TextEditingController();
  final _again = TextEditingController();

  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _new.dispose();
    _again.dispose();
    super.dispose();
  }

  bool get _ready =>
      _current.text.isNotEmpty && passwordMeetsRules(_new.text) && _new.text == _again.text && _new.text != _current.text;

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // A temporary password is copied from a message, so stray spaces around it are ignored.
      final current = widget.forced ? _current.text.trim() : _current.text;
      final token = await ApiService.changePassword(currentPassword: current, newPassword: _new.text);
      await AuthManager().completePasswordChange(token);
      if (!mounted) return;
      if (widget.forced) {
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => const MainNavigationScreen()),
          (route) => false,
        );
      } else {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(context.tr('cp.changed'))));
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e is ApiException ? e.message : context.tr('common.somethingWrong'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _signOut() async {
    await AuthManager().logout();
    if (!mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const OnboardingScreen()),
      (route) => false,
    );
  }

  Widget _field(String label, TextEditingController controller, {TextInputAction? action}) {
    return PasswordField(
      controller: controller,
      label: label,
      textInputAction: action ?? TextInputAction.next,
      onChanged: (_) => setState(() {}),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final mismatch = _again.text.isNotEmpty && _again.text != _new.text;

    return PopScope(
      canPop: !widget.forced,
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.forced ? context.tr('cp.chooseTitle') : context.tr('profile.changePassword')),
          automaticallyImplyLeading: !widget.forced,
        ),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (widget.forced) ...[
                  Text(
                    context.tr('cp.welcome', {'name': AuthManager().userName}),
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    context.tr('cp.tempIntro'),
                    style: TextStyle(color: c.textSecondary, height: 1.4),
                  ),
                  const SizedBox(height: 24),
                ],
                _field(widget.forced ? context.tr('cp.temporary') : context.tr('cp.current'), _current),
                const SizedBox(height: 16),
                _field(context.tr('fp.new'), _new),
                const SizedBox(height: 8),
                PasswordRulesList(password: _new.text),
                const SizedBox(height: 16),
                _field(context.tr('fp.repeat'), _again, action: TextInputAction.done),
                if (mismatch)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(context.tr('fp.mismatch'), style: TextStyle(color: c.dangerFg, fontSize: 12)),
                  ),
                if (_new.text.isNotEmpty && _new.text == _current.text)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      context.tr('cp.same'),
                      style: TextStyle(color: c.dangerFg, fontSize: 12),
                    ),
                  ),
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(_error!, style: TextStyle(color: c.dangerFg)),
                ],
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: (_busy || !_ready) ? null : _submit,
                  child: _busy
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : Text(widget.forced ? context.tr('cp.saveContinue') : context.tr('profile.changePassword')),
                ),
                if (widget.forced) ...[
                  const SizedBox(height: 12),
                  Center(
                    child: TextButton(
                      onPressed: _busy ? null : _signOut,
                      child: Text(context.tr('profile.signOut'), style: TextStyle(color: c.accent)),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
