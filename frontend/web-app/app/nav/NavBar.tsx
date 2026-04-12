import Search from './Search';
import Logo from './Logo';
import LoginButton from './LoginButton';
import { getCurrentUser } from '../actions/authActions';
import UserActions from './UserActions';

export default async function Navbar() {
    const user = await getCurrentUser();
    return (
        <header className='sticky top-0 z-50 flex flex-wrap justify-between bg-white shadow-md py-3 px-3 md:py-5 md:px-5 items-center text-gray-800 gap-2'>
            <Logo />
            <Search />
            {user ? (
                <UserActions user={user} />
            ) : (
                <LoginButton />
            )}
        </header>
    );
}
