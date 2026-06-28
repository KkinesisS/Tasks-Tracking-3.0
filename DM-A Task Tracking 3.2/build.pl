#!/usr/bin/env perl
use strict;
use warnings;
use File::Path qw(make_path);
use File::Copy qw(copy);
use File::Basename;

# Ensure build directory exists
if (! -d 'build') {
    make_path('build') or die "Cannot create build directory: $!";
}

# Files to wrap
my @css_files = ('styles.css', 'dark-mode.css');
my @js_files = ('tabs.js', 'manualIssues.js', 'app.js');

print "Compiling assets for Google Apps Script using Perl...\n";

# Read template HTML file (check index2.html first, fallback to index.html)
my $template_path = 'index2.html';
if (! -e $template_path) {
    $template_path = 'index.html';
}
if (! -e $template_path) {
    die "Error: Neither index.html nor index2.html was found.\n";
}
print "Using $template_path as template source...\n";
open(my $fh_in, '<:encoding(UTF-8)', $template_path) or die "Could not open $template_path: $!";
my $index_html = do { local $/; <$fh_in> };
close($fh_in);

# Replace stylesheet links with scriptlets
$index_html =~ s/<link rel="stylesheet" href="styles\.css">/<?!= include('styles'); ?>/g;
$index_html =~ s/<link rel="stylesheet" href="dark-mode\.css">/<?!= include('dark-mode'); ?>/g;

# Replace script tags with scriptlets
$index_html =~ s/<script src="tabs\.js"><\/script>/<?!= include('tabs'); ?>/g;
$index_html =~ s/<script src="manualIssues\.js"><\/script>/<?!= include('manualIssues'); ?>/g;
$index_html =~ s/<script src="app\.js"><\/script>/<?!= include('app'); ?>/g;

# Write index.html to build folder
open(my $fh_out, '>:encoding(UTF-8)', 'build/index.html') or die "Could not write build/index.html: $!";
print $fh_out $index_html;
close($fh_out);
print "$template_path -> build/index.html compiled.\n";

# Wrap and write CSS files as HTML
foreach my $file (@css_files) {
    if (-e $file) {
        open(my $fh, '<:encoding(UTF-8)', $file) or die "Could not open $file: $!";
        my $content = do { local $/; <$fh> };
        close($fh);
        my ($base_name) = $file =~ /^([^.]+)/;
        open(my $fh_html, '>:encoding(UTF-8)', "build/$base_name.html") or die "Could not write build/$base_name.html: $!";
        print $fh_html "<style>\n$content\n</style>";
        close($fh_html);
        print "$file wrapped -> build/$base_name.html\n";
    }
}

# Wrap and write JS files as HTML
foreach my $file (@js_files) {
    if (-e $file) {
        open(my $fh, '<:encoding(UTF-8)', $file) or die "Could not open $file: $!";
        my $content = do { local $/; <$fh> };
        close($fh);
        my ($base_name) = $file =~ /^([^.]+)/;
        open(my $fh_html, '>:encoding(UTF-8)', "build/$base_name.html") or die "Could not write build/$base_name.html: $!";
        print $fh_html "<script>\n$content\n</script>";
        close($fh_html);
        print "$file wrapped -> build/$base_name.html\n";
    }
}

# Copy Code.gs and appsscript.json if they exist
my @extra_files = ('Code.gs', 'appsscript.json');
foreach my $file (@extra_files) {
    if (-e $file) {
        copy($file, "build/$file") or die "Copy failed: $!";
        print "$file copied -> build/$file\n";
    }
}

print "Build completed successfully! Deploy the contents of the 'build' directory to Apps Script.\n";
