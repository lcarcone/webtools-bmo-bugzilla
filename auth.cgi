#!/usr/bin/perl -wT
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#
# This Source Code Form is "Incompatible With Secondary Licenses", as
# defined by the Mozilla Public License, v. 2.0.

use 5.10.1;
use strict;
use warnings;

use lib qw(. lib);

use Bugzilla;
use Bugzilla::Constants;
use Bugzilla::Error;
use Bugzilla::Hook;
use Bugzilla::Util qw(trick_taint);
use Bugzilla::Token qw(issue_auth_delegation_token check_auth_delegation_token);
use Bugzilla::Mailer qw(MessageToMTA);

use URI;
use URI::QueryParam;
use Digest::SHA qw(sha256_hex);

Bugzilla->login(LOGIN_REQUIRED);

ThrowUserError('auth_delegation_disabled') unless Bugzilla->params->{auth_delegation};

my $cgi         = Bugzilla->cgi;
my $template    = Bugzilla->template;
my $user        = Bugzilla->user;
my $callback    = $cgi->param('callback') or ThrowUserError("auth_delegation_missing_callback");
my $description = $cgi->param('description') or ThrowUserError("auth_delegation_missing_description");

trick_taint($callback);
trick_taint($description);

my $callback_uri  = URI->new($callback);
my $callback_base = $callback_uri->clone;
$callback_base->query(undef);

my $skip_confirmation = 0;
my %args = ( skip_confirmation => \$skip_confirmation,
             callback          => $callback_uri,
             description       => $description,
             callback_base     => $callback_base );

Bugzilla::Hook::process('auth_delegation_confirm', \%args);

my $confirmed = lc($cgi->request_method) eq 'post' && $cgi->param('confirm');

if ($confirmed || $skip_confirmation) {
    my $token = $cgi->param('token');
    unless ($skip_confirmation) {
        ThrowUserError("auth_delegation_missing_token") unless $token;
        trick_taint($token);

        unless (check_auth_delegation_token($token, $callback)) {
            ThrowUserError('auth_delegation_invalid_token',
                           { token => $token, callback => $callback });
        }
    }
    my $app_id = sha256_hex($callback_uri, $description);
    my $keys = Bugzilla::User::APIKey->match({
        user_id => $user->id,
        app_id  => $app_id,
        revoked => 0,
    });

    my $api_key;
    if (@$keys) {
        $api_key = $keys->[0];
    }
    else {
        $api_key = Bugzilla::User::APIKey->create({
            user_id     => $user->id,
            description => $description,
            app_id      => $app_id,
        });
        my $template = Bugzilla->template_inner($user->setting('lang'));
        my $vars = { user => $user, new_key => $api_key };
        my $message;
        $template->process('email/new-api-key.txt.tmpl', $vars, \$message)
          or ThrowTemplateError($template->error());

        MessageToMTA($message);
    }

    $callback_uri->query_param(client_api_key   => $api_key->api_key);
    $callback_uri->query_param(client_api_login => $user->login);

    print $cgi->redirect($callback_uri);
}
else {
    $args{token} = issue_auth_delegation_token($callback);

    print $cgi->header();
    $template->process("account/auth/delegation.html.tmpl", \%args)
      or ThrowTemplateError($template->error());
}
