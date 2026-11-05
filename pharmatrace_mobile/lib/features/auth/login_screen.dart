import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../../core/auth_manager.dart';
import '../../data/services/api_service.dart';
import '../../core/main_navigation.dart';
import '../../core/widgets/password_field.dart';
import 'change_password_screen.dart';
import 'forgot_password_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _contactController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _isLoading = false;
  String? _errorMessage;

  Future<void> _handleLogin() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final data = await ApiService.login(
        _contactController.text.trim(),
        _passwordController.text.trim(), // a pasted temporary password may carry a stray space
      );

      final user = data['user'];

      if (user is! Map<String, dynamic>) {
        throw Exception('Invalid user information returned by the server.');
      }

      final token = data['token'];
      final name = user['name'];
      final sector = user['sector'];
      final profilePicUrl = user['profile_pic_url'];
      final mustChange = user['must_change_password'] == true;

      if (token is! String || token.isEmpty) {
        throw Exception('The server did not return a valid login token.');
      }

      // Save the server-returned token and profile details locally.
      await AuthManager().loginAsPharmacist(
        token,
        name?.toString() ?? '',
        sector?.toString() ?? '',
        profilePicUrl?.toString(),
        mustChange: mustChange,
      );

      if (!mounted) return;

      // A temporary password from the regulator must be replaced before anything else works.
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => mustChange ? const ChangePasswordScreen(forced: true) : const MainNavigationScreen(),
        ),
      );
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _errorMessage = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _contactController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pharmacist Sign In'),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text(
                  'Welcome back',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Sign in to report anomalies and manage inventory.',
                  style: TextStyle(
                    color: context.colors.textSecondary,
                  ),
                ),
                const SizedBox(height: 32),
                TextField(
                  controller: _contactController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email or Phone',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                PasswordField(
                  controller: _passwordController,
                  label: 'Password',
                  autofillHints: const [AutofillHints.password],
                  textInputAction: TextInputAction.done,
                  onSubmitted: _isLoading ? null : _handleLogin,
                ),
                if (_errorMessage != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    _errorMessage!,
                    style: TextStyle(
                      color: context.colors.dangerFg,
                    ),
                  ),
                ],
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: _isLoading
                        ? null
                        : () async {
                            final email = await Navigator.push<String>(
                              context,
                              MaterialPageRoute(
                                builder: (_) => ForgotPasswordScreen(initialEmail: _contactController.text.trim()),
                              ),
                            );
                            if (email != null && email.isNotEmpty && mounted) {
                              setState(() => _contactController.text = email);
                            }
                          },
                    child: Text('Forgot password?', style: TextStyle(color: context.colors.accent)),
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _isLoading ? null : _handleLogin,
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Text('Sign In'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}