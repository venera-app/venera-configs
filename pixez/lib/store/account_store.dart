import 'package:pixez/er/prefer.dart';
import 'package:pixez/models/account.dart';

class AccountStore {
  AccountProvider accountProvider = AccountProvider();
  AccountPersist? now;
  int index = 0;
  List<AccountPersist> accounts = [];

  Future<void> select(int index) async {
    await Prefer.setInt('account_select_num', index);
    now = accounts[index];
    this.index = index;
  }

  Future<void> deleteAll() async {
    await accountProvider.open();
    await accountProvider.deleteAll();
    now = null;
  }

  Future<void> updateSingle(AccountPersist accountPersist) async {
    await accountProvider.open();
    await accountProvider.update(accountPersist);
    await fetch();
  }

  Future<void> deleteSingle(int id) async {
    await accountProvider.open();
    await accountProvider.delete(id);
    await fetch();
  }

  Future<void> fetch() async {
    try {
      await accountProvider.open();
      List<AccountPersist> list = await accountProvider.getAllAccount();
      accounts.clear();
      accounts.addAll(list);
      await Prefer.init();
      var i = Prefer.getInt('account_select_num');
      if (list.isNotEmpty) {
        index = i ?? 0;
        now = list[i ?? 0];
      }
    } catch (e) {}
  }
}
