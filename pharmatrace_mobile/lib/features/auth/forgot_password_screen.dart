import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme.dart';
import '../../core/widgets/password_rules.dart';
import '../../data/services/api_service.dart';

enum _Step { email, code, done }

/// Email -> 6-digit code -> new password. The server answers the first step the same way
/// whether or not the address has an account, so this screen never says which it was.
class ForgotPasswordScreen extends StatefulWidget {
  /// Pre-fills the address typed on the sign-in screen.
  final String initialEmail;
  const ForgotPasswordScreen({super.key, this.initialEmail = ''});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  late final TextEditingController _email = TextEditingController(text: widget.initialEmail.contains('@') ? widget.initialEmail : '');
  final _code = TextEditingController();
  final _new = TextEditingController();
  final _again = TextEditingController();

  _Step _step = _Step.email;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    _new.dispose();
    _again.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } catch (e) {
      if (mounted) setState(() => _error = e is ApiException ? e.message : 'Something went wrong. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sendCode() => _run(() async {
        await ApiService.requestResetCode(_email.text.trim());
        if (mounted) setState(() => _step = _Step.code);
      });

  Future<void> _reset() => _run(() async {
        await ApiService.resetPassword(
          email: _email.text.trim(),
          code: _code.text.trim(),
          newPassword: _new.text,
        );
        if (mounted) setState(() => _step = _Step.done);
      });

  Widget _spinner() => const SizedBox(
        height: 20,
        width: 20,
        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
      );

  Widget _heading(String title, String body) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Text(body, style: TextStyle(color: c.textSecondary, height: 1.4)),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _emailStep() {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _heading('Forgot your password?', 'Enter your email address. We will send a 6-digit code that works for 15 minutes.'),
        TextField(
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          autocorrect: false,
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(labelText: 'Email address', border: OutlineInputBorder()),
        ),
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_error!, style: TextStyle(color: c.dangerFg)),
        ],
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: (_busy || !_email.text.contains('@')) ? null : _sendCode,
          child: _busy ? _spinner() : const Text('Send code'),
        ),
        const SizedBox(height: 16),
        Text(
          'No email on your account, or no code arrives? Ask a regulator to reset your password from the dashboard.',
          style: TextStyle(color: c.textSecondary, fontSize: 12, height: 1.4),
        ),
      ],
    );
  }

  Widget _codeStep() {
    final c = context.colors;
    final mismatch = _again.text.isNotEmpty && _again.text != _new.text;
    final ready = _code.text.length == 6 && passwordMeetsRules(_new.text) && _new.text == _again.text;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _heading('Enter the code', 'If ${_email.text.trim()} belongs to an account, a code is on its way. Enter it with your new password.'),
        TextField(
          controller: _code,
          keyboardType: TextInputType.number,
          maxLength: 6,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          autofillHints: const [AutofillHints.oneTimeCode],
          onChanged: (_) => setState(() {}),
          style: const TextStyle(letterSpacing: 6, fontFamily: 'monospace', fontSize: 18),
          decoration: const InputDecoration(labelText: '6-digit code', counterText: '', border: OutlineInputBorder()),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _new,
          obscureText: true,
          enableSuggestions: false,
          autocorrect: false,
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(labelText: 'New password', border: OutlineInputBorder()),
        ),
        const SizedBox(height: 8),
        PasswordRulesList(password: _new.text),
        const SizedBox(height: 16),
        TextField(
          controller: _again,
          obscureText: true,
          enableSuggestions: false,
          autocorrect: false,
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(labelText: 'Repeat the new password', border: OutlineInputBorder()),
        ),
        if (mismatch)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text('The two passwords do not match.', style: TextStyle(color: c.dangerFg, fontSize: 12)),
          ),
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_error!, style: TextStyle(color: c.dangerFg)),
        ],
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: (_busy || !ready) ? null : _reset,
          child: _busy ? _spinner() : const Text('Set new password'),
        ),
        const SizedBox(height: 12),
        Center(
          child: TextButton(
            onPressed: _busy
                ? null
                : () => setState(() {
                      _step = _Step.email;
                      _error = null;
                    }),
            child: Text('Send a new code', style: TextStyle(color: c.accent)),
          ),
        ),
      ],
    );
  }

  Widget _doneStep() {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.check_circle, size: 48, color: c.successFg),
        const SizedBox(height: 16),
        _heading('Password updated', 'You can sign in with your new password now.'),
        ElevatedButton(onPressed: () => Navigator.pop(context, _email.text.trim()), child: const Text('Back to sign in')),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reset password')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: switch (_step) {
            _Step.email => _emailStep(),
            _Step.code => _codeStep(),
            _Step.done => _doneStep(),
          },
        ),
      ),
    );
  }
}
